using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pawly_sayt.Data;
using Pawly_sayt.Dtos;
using Pawly_sayt.Models;
using Pawly_sayt.Services;

namespace Pawly_sayt.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;
    private readonly PasswordHasher<AppUser> _hasher = new();

    public AuthController(AppDbContext db, IConfiguration config, ILogger<AuthController> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    private string ClientIp => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "naməlum";

    // Kodun "izini" (SHA-256) çıxarır. Bazada kodun özünü yox, yalnız izini saxlayırıq.
    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    // Təsdiq kodu yaradır, bazaya izini yazır və istifadəçiyə məktub göndərir
    private async Task<bool> SendConfirmationEmail(AppUser user)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        user.EmailConfirmTokenHash = Hash(token);
        user.EmailConfirmExpires = DateTime.UtcNow.AddHours(24);   // 24 saat keçərlidir
        await _db.SaveChangesAsync();

        var baseUrl = _config["App:BaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
        var link = $"{baseUrl}/verify-email.html?email={Uri.EscapeDataString(user.Email)}&token={token}";

        var html = $@"
            <div style='font-family:Arial,sans-serif;font-size:16px;color:#222;'>
              <h2>Pawly-yə xoş gəlmisiniz!</h2>
              <p>Salam, {System.Net.WebUtility.HtmlEncode(user.FullName)}!</p>
              <p>Qeydiyyatı tamamlamaq üçün e-poçt ünvanınızı təsdiqləyin. Link 24 saat keçərlidir.</p>
              <p><a href='{link}' style='background:#E2583E;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;'>E-poçtu təsdiqlə</a></p>
              <p style='color:#777;font-size:13px;'>Pawly-də qeydiyyatdan keçməmisinizsə, bu məktuba məhəl qoymayın.</p>
            </div>";

        return await new EmailSender(_config).SendAsync(user.Email, "Pawly – e-poçtunuzu təsdiqləyin", html);
    }

    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email))
        {
            return Conflict(new { message = "Bu e-poçt ilə artıq hesab var." });
        }

        var user = new AppUser
        {
            FullName = dto.FullName.Trim(),
            Email = email
        };
        user.PasswordHash = _hasher.HashPassword(user, dto.Password);

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Yeni qeydiyyat: {Email}, IP: {Ip}", email, ClientIp);

        // Məktub göndərilməsə belə qeydiyyat qalır: istifadəçi sonra "Yenidən göndər" edə bilər
        var sent = await SendConfirmationEmail(user);

        return Ok(new
        {
            id = user.Id,
            fullName = user.FullName,
            email = user.Email,
            message = sent
                ? "Qeydiyyat tamamlandı. E-poçtunuza təsdiq linki göndərildi."
                : "Qeydiyyat tamamlandı, amma təsdiq məktubu göndərilmədi. Daxil olduqdan sonra yenidən göndərə bilərsiniz."
        });
    }

    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto, [FromServices] AttemptLimiter limiter)
    {
        var email = dto.Email.Trim().ToLowerInvariant();

        // Bir e-poçta 15 dəqiqədə 5 uğursuz cəhddən sonra giriş müvəqqəti bağlanır
        var lockKey = $"login:{email}";
        if (limiter.IsBlocked(lockKey, 5))
        {
            _logger.LogWarning("Giriş müvəqqəti bağlıdır (çox uğursuz cəhd): {Email}", email);
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { message = "Bu hesaba çox sayda uğursuz giriş cəhdi edilib. 15 dəqiqə sonra yenidən cəhd edin." });
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        var failed = new { message = "E-poçt və ya parol səhvdir." };
        if (user == null)
        {
            limiter.Register(lockKey, TimeSpan.FromMinutes(15));
            _logger.LogWarning("Uğursuz giriş (belə hesab yoxdur): {Email}, IP: {Ip}", email, ClientIp);
            return Unauthorized(failed);
        }

        var check = _hasher.VerifyHashedPassword(user, user.PasswordHash, dto.Password);
        if (check == PasswordVerificationResult.Failed)
        {
            limiter.Register(lockKey, TimeSpan.FromMinutes(15));
            _logger.LogWarning("Uğursuz giriş (yanlış parol): {Email}, IP: {Ip}", email, ClientIp);
            return Unauthorized(failed);
        }

        // Parol düzgündür: uğursuz cəhdlərin sayğacını sıfırlayırıq
        limiter.Reset(lockKey);

        // Bloklama yoxlaması parol yoxlamasından SONRA edilir.
        // Beləcə kənar adam hansı hesabın bloklandığını öyrənə bilməz.
        if (user.IsBlocked)
        {
            _logger.LogWarning("Bloklanmış hesabla giriş cəhdi: {Email}, IP: {Ip}", email, ClientIp);
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "Hesabınız bloklanıb. Ətraflı məlumat üçün bizimlə əlaqə saxlayın." });
        }

        _logger.LogInformation("Uğurlu giriş: {Email}, IP: {Ip}", email, ClientIp);

        return Ok(new
        {
            token = CreateToken(user),
            user = new
            {
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                role = user.Role.ToString(),
                emailConfirmed = user.EmailConfirmed
            }
        });
    }

    // E-poçtdakı linkə basanda: kodu yoxlayır və hesabı təsdiqləyir
    [EnableRateLimiting("auth")]
    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail(ConfirmEmailDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Artıq təsdiqlənibsə, xəta vermirik
        if (user != null && user.EmailConfirmed)
            return Ok(new { message = "E-poçtunuz artıq təsdiqlənib." });

        var invalid = user == null
            || user.EmailConfirmTokenHash == null
            || user.EmailConfirmExpires == null
            || user.EmailConfirmExpires < DateTime.UtcNow
            || !CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(Hash(dto.Token)),
                   Encoding.UTF8.GetBytes(user.EmailConfirmTokenHash));

        if (invalid)
            return BadRequest(new { message = "Link köhnəlib və ya yanlışdır. Daxil olub yeni link istəyin." });

        user!.EmailConfirmed = true;
        user.EmailConfirmTokenHash = null;   // kod bir dəfəlikdir
        user.EmailConfirmExpires = null;
        await _db.SaveChangesAsync();

        _logger.LogInformation("E-poçt təsdiqləndi: {Email}", email);
        return Ok(new { message = "E-poçtunuz təsdiqləndi. İndi elan yerləşdirə bilərsiniz!" });
    }

    // Təsdiq məktubunu yenidən göndər (daxil olmuş istifadəçi üçün)
    [Authorize]
    [EnableRateLimiting("forgot")]
    [HttpPost("resend-confirmation")]
    public async Task<IActionResult> ResendConfirmation()
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(id);
        if (user == null) return Unauthorized();

        if (user.EmailConfirmed)
            return BadRequest(new { message = "E-poçtunuz artıq təsdiqlənib." });

        var sent = await SendConfirmationEmail(user);
        if (!sent)
            return StatusCode(StatusCodes.Status502BadGateway,
                new { message = "Məktub göndərilmədi. Bir az sonra yenidən cəhd edin." });

        return Ok(new { message = "Təsdiq linki e-poçtunuza yenidən göndərildi." });
    }

    // Yalnız bileti olan istifadəçi bura girə bilər (bileti yoxlamaq üçün)
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(id);
        if (user == null) return Unauthorized();

        return Ok(new
        {
            id = user.Id,
            fullName = user.FullName,
            email = user.Email,
            role = user.Role.ToString(),
            emailConfirmed = user.EmailConfirmed
        });
    }

        // Hesabı silmək: istifadəçi, onun elanları, şəkilləri və şikayətləri birdəfəlik silinir
    [Authorize]
    [EnableRateLimiting("auth")]
    [HttpPost("delete-account")]
    public async Task<IActionResult> DeleteAccount(DeleteAccountDto dto, [FromServices] IWebHostEnvironment env)
    {
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(id);
        if (user == null) return Unauthorized();

        if (user.Role == UserRole.Admin)
            return BadRequest(new { message = "Admin hesabı saytdan silinə bilməz." });

        var check = _hasher.VerifyHashedPassword(user, user.PasswordHash, dto.Password);
        if (check == PasswordVerificationResult.Failed)
            return BadRequest(new { message = "Parol yanlışdır." });

        var listings = await _db.Listings
            .Include(l => l.Photos)
            .Where(l => l.UserId == id)
            .ToListAsync();
        var photoFiles = listings
            .SelectMany(l => l.Photos)
            .Select(p => Path.GetFileName(p.Url))
            .ToList();

        // İstifadəçinin göndərdiyi şikayətlər (onun elanlarına gələnlər elanla birlikdə silinir)
        var reports = await _db.ListingReports.Where(r => r.UserId == id).ToListAsync();
        _db.ListingReports.RemoveRange(reports);
        _db.Listings.RemoveRange(listings);
        _db.Users.Remove(user);

        // Hamısı birlikdə yazılır: ya hamısı silinir, ya heç biri
        await _db.SaveChangesAsync();

        // Şəkil fayllarını yalnız baza uğurla yeniləndikdən sonra silirik
        var uploadsFolder = Path.Combine(env.WebRootPath, "uploads");
        foreach (var file in photoFiles)
        {
            var path = Path.Combine(uploadsFolder, file);
            try
            {
                if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Şəkil faylı silinmədi: {File}", file);
            }
        }

        _logger.LogInformation("Hesab silindi: {Email}, IP: {Ip}", user.Email, ClientIp);
        return Ok(new { message = "Hesabınız və bütün elanlarınız silindi." });
    }
    private string CreateToken(AppUser user)
    {
        var jwt = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),   // "User" və ya "Admin"
            new Claim("tv", user.TokenVersion.ToString())        // vəsiqə versiyası
        };

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(int.Parse(jwt["ExpireDays"]!)),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// E-poçt təsdiqi üçün gələn məlumat
public class ConfirmEmailDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(128)]
    public string Token { get; set; } = string.Empty;
}



// Hesabı silmək üçün parol təsdiqi
public class DeleteAccountDto
{
    [Required, MaxLength(200)]
    public string Password { get; set; } = string.Empty;
}