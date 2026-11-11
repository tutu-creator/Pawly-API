using System.Text.Json.Serialization;

namespace Pawly_sayt.Models;

public class ListingPhoto
{
    public int Id { get; set; }

    public int ListingId { get; set; }
    
    [JsonIgnore]
    public Listing Listing { get; set; } = null!;

    public string Url { get; set; } = string.Empty;
}