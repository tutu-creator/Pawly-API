using System.ComponentModel.DataAnnotations;

namespace Pawly_sayt.Dtos;

public class LoginDto
{
    [Required]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}