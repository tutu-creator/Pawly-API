using System.Net;
using System.Net.Mail;
using System.Text;

namespace Pawly_sayt.Services;

// E-poçt göndərən köməkçi. Pawly-nin Gmail hesabından (SMTP ilə) göndərir.
// Gmail ünvanı və tətbiq parolu "gizli seyf"dədir (Smtp:User, Smtp:Password).
public class EmailSender
{
    private readonly IConfiguration _config;

    public EmailSender(IConfiguration config)
    {
        _config = config;
    }

    // Uğurlu göndərildisə true, olmadısa false qaytarır
    public async Task<bool> SendAsync(string to, string subject, string html)
    {
        var user = _config["Smtp:User"];
        var password = _config["Smtp:Password"];

        if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine("E-poçt göndərilmədi: Smtp:User və ya Smtp:Password təyin olunmayıb.");
            return false;
        }

        // Gmail-in məktub serveri. Lazım olsa, sonra başqa xidmətə keçmək üçün ayarlardan dəyişmək olar.
        var host = _config["Smtp:Host"] ?? "smtp.gmail.com";
        var port = int.TryParse(_config["Smtp:Port"], out var p) ? p : 587;

        using var message = new MailMessage
        {
            From = new MailAddress(user, "Pawly"),   // alıcı "Pawly" adını görəcək
            Subject = subject,
            Body = html,
            IsBodyHtml = true,
            BodyEncoding = Encoding.UTF8,
            SubjectEncoding = Encoding.UTF8
        };
        message.To.Add(to);

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true,   // məktub şifrələnmiş bağlantı ilə göndərilir
            Credentials = new NetworkCredential(user, password)
        };

        try
        {
            await client.SendMailAsync(message);
            return true;
        }
        catch (Exception ex)
        {
            // Səhv olsa, səbəbi Rider-in konsoluna yazırıq ki, görə bilək
            Console.WriteLine($"E-poçt göndərilmədi: {ex.Message}");
            return false;
        }
    }
}