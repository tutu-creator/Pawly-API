using System.ComponentModel.DataAnnotations;

namespace Pawly_sayt.Dtos;

// "Parolu unutdum" formasından gələn məlumat
public class ForgotPasswordDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;
}

// Yeni parol təyin edən formadan gələn məlumat
public class ResetPasswordDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Token { get; set; } = string.Empty;

    [Required, MinLength(8)]
    public string NewPassword { get; set; } = string.Empty;
}