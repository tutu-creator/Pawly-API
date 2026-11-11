using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pawly_sayt.Data;
using Pawly_sayt.Dtos;
using Pawly_sayt.Models;
using Pawly_sayt.Services;
using Microsoft.AspNetCore.RateLimiting;

namespace Pawly_sayt.Controllers;

[ApiController]
[Route("api/password")]
public class PasswordController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly PasswordHasher<AppUser> _hasher = new();

    public PasswordController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    // Kodun "izini" (SHA-256) çıxarır. Bazada kodun özünü yox, yalnız izini saxlayırıq.
    // Bazaya kimsə girsə belə, bu izdən real kodu tapıb link yarada bilməz.
    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    // 1-ci addım: istifadəçi e-poçtunu yazır, ona link göndərilir
    [EnableRateLimiting("forgot")]
    [HttpPost("forgot")]
    public async Task<IActionResult> Forgot(ForgotPasswordDto dto, [FromServices] AttemptLimiter limiter)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Bir e-poçta 10 dəqiqədə ən çox 3 məktub. Limit dolanda cavab dəyişmir,
        // sadəcə məktub göndərilmir (kənar adam heç nə öyrənə bilməsin deyə).
        var mailKey = $"forgot:{email}";
        if (user != null && !limiter.IsBlocked(mailKey, 3))
        {
            limiter.Register(mailKey, TimeSpan.FromMinutes(10));
            // 64 hərflik təsadüfi gizli kod
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

            user.PasswordResetTokenHash = Hash(token);
            user.PasswordResetExpires = DateTime.UtcNow.AddHours(1);   // 1 saat keçərlidir
            await _db.SaveChangesAsync();

            var baseUrl = _config["App:BaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
            var link = $"{baseUrl}/reset-password.html?email={Uri.EscapeDataString(email)}&token={token}";

            var html = $@"
                <div style='font-family:Arial,sans-serif;font-size:16px;color:#222;'>
                  <h2>Pawly – parolun yenilənməsi</h2>
                  <p>Salam, {System.Net.WebUtility.HtmlEncode(user.FullName)}!</p>
                  <p>Parolunu yeniləmək üçün aşağıdakı düyməyə bas. Link 1 saat keçərlidir.</p>
                  <p><a href='{link}' style='background:#E2583E;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;'>Parolu yenilə</a></p>
                  <p style='color:#777;font-size:13px;'>Bu sorğunu sən göndərməmisənsə, bu məktuba məhəl qoyma.</p>
                </div>";

            await new EmailSender(_config).SendAsync(user.Email, "Pawly – parolun yenilənməsi", html);
        }

        // Həmişə eyni cavab veririk. Beləcə kənar adam hansı e-poçtun
        // qeydiyyatda olduğunu bu formadan öyrənə bilməz.
        return Ok(new { message = "Bu e-poçt qeydiyyatdadırsa, parolu yeniləmək üçün link göndərildi." });
    }

    // 2-ci addım: istifadəçi linkdən gəlib yeni parol yazır
    [EnableRateLimiting("auth")]
    [HttpPost("reset")]
    public async Task<IActionResult> Reset(ResetPasswordDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        var invalid = user == null
            || user.PasswordResetTokenHash == null
            || user.PasswordResetExpires == null
            || user.PasswordResetExpires < DateTime.UtcNow
            || !CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(Hash(dto.Token)),
                   Encoding.UTF8.GetBytes(user.PasswordResetTokenHash));

        if (invalid)
            return BadRequest(new { message = "Link köhnəlib və ya yanlışdır. Yenidən sorğu göndərin." });

        user!.PasswordHash = _hasher.HashPassword(user, dto.NewPassword);
        user.TokenVersion++;   // köhnə vəsiqələrin hamısı ləğv olunur

        // Kod bir dəfəlikdir: istifadə olunandan sonra silirik
        user.PasswordResetTokenHash = null;
        user.PasswordResetExpires = null;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Parol yeniləndi. İndi daxil ola bilərsiniz." });
    }
}