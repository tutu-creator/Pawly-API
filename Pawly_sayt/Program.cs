using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pawly_sayt.Data;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Pawly_sayt.Services;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Giriş vəsiqəsi (JWT) yoxlaması
var jwt = builder.Configuration.GetSection("Jwt");


// Açar təyin olunmayıbsa, proqram aydın xəta ilə dayansın
var jwtKey = jwt["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key təyin olunmayıb və ya çox qısadır. İnkişaf zamanı: dotnet user-secrets set 'Jwt:Key' '...'");
}
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!))
        };

        // Hər sorğuda vəsiqənin versiyasını bazadakı ilə müqayisə edirik.
        // Parol dəyişibsə və ya istifadəçi bloklanıbsa, vəsiqə rədd edilir.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var idValue = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var tvValue = context.Principal?.FindFirstValue("tv");

                if (!int.TryParse(idValue, out var userId) || !int.TryParse(tvValue, out var tokenVersion))
                {
                    context.Fail("Vəsiqə etibarsızdır.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var state = await db.Users
                    .Where(u => u.Id == userId)
                    .Select(u => new { u.TokenVersion, u.IsBlocked })
                    .FirstOrDefaultAsync();

                // İstifadəçi yoxdursa, parol dəyişibsə və ya bloklanıbsa, vəsiqə rədd edilir
                if (state == null || state.TokenVersion != tokenVersion || state.IsBlocked)
                {
                    context.Fail("Vəsiqə ləğv olunub.");
                }
            }
        };
    });

// Sürət limiti: eyni adam çox tez-tez sorğu göndərərsə, server onu bir müddət dayandırır.
// Bu, parol tapmaq üçün "min dəfə cəhd etməyin" və məktub "bombardmanının" qarşısını alır.

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Limit aşılanda istifadəçiyə göstəriləcək cavab
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"message\":\"Çox sayda cəhd etdiniz. Bir az gözləyib yenidən cəhd edin.\"}", token);
    };

    // QEYD: hostinq ziyarətçilərin real ünvanını ötürmür, server hamını eyni ünvandan görür.
    // Ona görə bu limitlər faktiki olaraq bütün sayt üçün ortaqdır və yalnız kütləvi hücumdan qoruyur.
    // Hesab səviyyəsində qoruma (e-poçta görə) AttemptLimiter ilə controller-lərdə edilir.

    // "auth": giriş, qeydiyyat, yeni parol. Dəqiqədə 100 cəhd.
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // "forgot": "Parolu unutdum" və təsdiq məktubları. 10 dəqiqədə 30 sorğu.
    options.AddPolicy("forgot", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0
            }));

    // "report": şikayətlər. Saatda 100 şikayət.
    // (Bir istifadəçi eyni elandan onsuz da yalnız bir dəfə şikayət edə bilir.)
    options.AddPolicy("report", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0
            }));
});


// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Uğursuz cəhdləri e-poçta görə saymaq üçün (sürət limitinə əlavə qoruma)
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<AttemptLimiter>();

// Magick.NET (HEIC çevirmə) üçün təhlükəsizlik limitləri:
// həddən artıq böyük və ya qəsdən korlanmış şəkillər serveri yükləyə bilməsin.
// Kitabxana bu kompüterdə işləmirsə (məsələn, Intel .NET olan Mac), sayt çökmür,
// sadəcə HEIC çevirmə söndürülür.
try
{
    ImageMagick.ResourceLimits.Width = 12000;
    ImageMagick.ResourceLimits.Height = 12000;
    ImageMagick.ResourceLimits.Memory = 512UL * 1024 * 1024;   // 512 MB
}
catch (Exception ex)
{
    Console.WriteLine($"Xəbərdarlıq: Magick.NET yüklənmədi, HEIC çevirmə işləməyəcək. ({ex.GetType().Name})");
}

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Real serverdə brauzerə "bu saytı yalnız HTTPS ilə aç" deyirik
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

// Təhlükəsizlik başlıqları: hər cavabla birlikdə brauzerə qaydalar göndəririk
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;

    // Brauzer faylın növünü "təxmin etməsin" (məs. şəkil adı altında skript işlətməsin)
    headers["X-Content-Type-Options"] = "nosniff";

    // Sayt başqa saytın içinə (iframe) yerləşdirilməsin, saxta düymə hücumlarına qarşı
    headers["X-Frame-Options"] = "DENY";

    // Başqa sayta keçəndə tam ünvanımız ötürülməsin
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    // Məkan yalnız öz saytımızda, kamera və mikrofon heç yerdə
    headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()";

    // Hansı mənbələrdən skript, şrift, şəkil yüklənə bilər
    headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self' https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: blob: https://tile.openstreetmap.org; " +
        "connect-src 'self'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'";

    await next();
});
// Elan linkləri paylaşılanda şəkilli önizləmə (WhatsApp, LinkedIn və s.)
app.UseListingPreview();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;

        // İnkişaf zamanı: heç nə yadda saxlanmasın, hər dəyişiklik dərhal görünsün
        if (app.Environment.IsDevelopment())
        {
            headers.CacheControl = "no-cache, no-store, must-revalidate";
            return;
        }

        var ext = Path.GetExtension(ctx.File.Name).ToLowerInvariant();

        if (ext is ".html" or ".js" or ".css")
        {
            // Brauzer saxlaya bilər, amma hər dəfə serverdən "dəyişibmi?" deyə soruşmalıdır.
            // Beləcə yeniləmədən sonra hamı dərhal yeni versiyanı görür.
            headers.CacheControl = "no-cache";
        }
        else
        {
            // Şəkillər, şriftlər, ikonlar: 7 gün yaddaşda qala bilər
            headers.CacheControl = "public, max-age=604800";
        }
    }
});


app.UseRateLimiter();      // sürət limitini işə salır
app.UseAuthentication();   // kimsən? (biletə baxır)
app.UseAuthorization();    // icazən varmı?

app.MapControllers();


app.Run();