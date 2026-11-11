namespace Pawly_sayt.Models;

public class AppUser
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public string? PasswordResetTokenHash { get; set; }   // gizli kodun "izi" (kodun özü saxlanmır)
    public DateTime? PasswordResetExpires { get; set; }   // kodun bitmə vaxtı (1 saat sonra)

    // Vəsiqə versiyası: parol dəyişəndə artır, köhnə vəsiqələr ləğv olunur
    public int TokenVersion { get; set; }

    public UserRole Role { get; set; } = UserRole.User;
    public bool IsBlocked { get; set; }          // bloklanıbsa daxil ola bilməz

    // E-poçt təsdiqi
    public bool EmailConfirmed { get; set; }                // linkə basıbsa true
    public string? EmailConfirmTokenHash { get; set; }      // təsdiq kodunun "izi"
    public DateTime? EmailConfirmExpires { get; set; }      // kodun bitmə vaxtı (24 saat)
}