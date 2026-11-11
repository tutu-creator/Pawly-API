using System.Text.Json.Serialization;

namespace Pawly_sayt.Models;

public class ListingReport
{
    public int Id { get; set; }

    public int ListingId { get; set; }
    [JsonIgnore]
    public Listing? Listing { get; set; }

    public int UserId { get; set; }          // şikayəti göndərən
    [JsonIgnore]
    public AppUser? User { get; set; }

    public ReportReason Reason { get; set; }
    public string? Comment { get; set; }     // istəyə bağlı izah

    public ReportStatus Status { get; set; } = ReportStatus.Open;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}