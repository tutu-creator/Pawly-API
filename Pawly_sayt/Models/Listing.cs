namespace Pawly_sayt.Models;
using System.Text.Json.Serialization;

public class Listing
{
    public int Id { get; set; }

    public ListingType Type { get; set; }
    public AnimalKind AnimalKind { get; set; }

    public string? Title { get; set; }
    public string? PetName { get; set; }
    public string? Breed { get; set; }
    public string? Age { get; set; }
    public string? Color { get; set; }
    public string? LostDate { get; set; }
    public string? ObservedDuration { get; set; }
    public string? Conditions { get; set; }       // "acdır|susuzdur" kimi saxlanır

    public string Description { get; set; } = string.Empty;

    public string City { get; set; } = string.Empty;
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public string? ContactInfo { get; set; }

    public ListingStatus Status { get; set; } = ListingStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<ListingPhoto> Photos { get; set; } = new();
    
    public int? UserId { get; set; }

    [JsonIgnore]
    public AppUser? User { get; set; }
}