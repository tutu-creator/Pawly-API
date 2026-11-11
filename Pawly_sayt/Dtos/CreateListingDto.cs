using System.ComponentModel.DataAnnotations;
using Pawly_sayt.Models;

namespace Pawly_sayt.Dtos;

public class CreateListingDto
{
    public ListingType Type { get; set; }
    public AnimalKind AnimalKind { get; set; }

    [MaxLength(200)] public string? Title { get; set; }
    [MaxLength(100)] public string? PetName { get; set; }
    [MaxLength(100)] public string? Breed { get; set; }
    [MaxLength(50)] public string? Age { get; set; }
    [MaxLength(100)] public string? Color { get; set; }
    [MaxLength(20)] public string? LostDate { get; set; }
    [MaxLength(100)] public string? ObservedDuration { get; set; }

    public List<string>? Conditions { get; set; }

    [Required, MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Address { get; set; }

    [Range(-90, 90)]
    public double? Latitude { get; set; }

    [Range(-180, 180)]
    public double? Longitude { get; set; }

    [MaxLength(100)]
    public string? ContactInfo { get; set; }
}