using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Pawly_sayt.Data;
using Pawly_sayt.Models;

namespace Pawly_sayt.Services;

// Elan linki WhatsApp, LinkedIn, Facebook və s.-də paylaşılanda
// şəkilli önizləmə görünsün deyə səhifəyə məlumat (Open Graph) əlavə edir.
// Bu xidmətlər JavaScript işlətmir, ona görə məlumatı server özü yazır.
public static class ListingPreview
{
    public static WebApplication UseListingPreview(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.Equals("/listing-detail.html", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(context.Request.Query["id"], out var id))
            {
                string? html = null;
                try
                {
                    html = await BuildPageAsync(context, app.Environment, id);
                }
                catch
                {
                    // Önizləmə hazırlanmasa belə, səhifə adi qaydada açılsın
                    html = null;
                }
                if (html != null)
                {
                    context.Response.ContentType = "text/html; charset=utf-8";
                    context.Response.Headers.CacheControl = "no-cache";
                    await context.Response.WriteAsync(html);
                    return;
                }
            }

            // Elan tapılmasa və ya başqa səhifədirsə, adi qaydada davam edirik
            await next();
        });

        return app;
    }

    private static async Task<string?> BuildPageAsync(HttpContext context, IWebHostEnvironment env, int id)
    {
        var db = context.RequestServices.GetRequiredService<AppDbContext>();
        var listing = await db.Listings
            .AsNoTracking()
            .Include(l => l.Photos)
            .Include(l => l.User)
            .FirstOrDefaultAsync(l => l.Id == id);

        // Elan yoxdursa və ya sahibi bloklanıbsa, önizləmə vermirik
        if (listing == null || (listing.User != null && listing.User.IsBlocked)) return null;

        var filePath = Path.Combine(env.WebRootPath, "listing-detail.html");
        if (!File.Exists(filePath)) return null;
        var html = await File.ReadAllTextAsync(filePath);

        var config = context.RequestServices.GetRequiredService<IConfiguration>();
        var baseUrl = (config["App:BaseUrl"] ?? $"{context.Request.Scheme}://{context.Request.Host}").TrimEnd('/');

        // Başlıq: "İTİB: Mavi (pişik) – Bakı" kimi
        var animal = listing.AnimalKind switch
        {
            AnimalKind.Dog => "it",
            AnimalKind.Cat => "pişik",
            _ => "heyvan"
        };
        var place = string.IsNullOrWhiteSpace(listing.City) ? "" : $" – {listing.City}";
        var title = listing.Type switch
        {
            ListingType.Lost => !string.IsNullOrWhiteSpace(listing.PetName)
                ? $"İTİB: {listing.PetName} ({animal}){place}"
                : $"İtmiş {animal}{place}",
            ListingType.NeedsHelp => $"Köməyə ehtiyacı olan {animal}{place}",
            _ => $"Sahibsiz {animal}{place}"
        };
        if (listing.Status == ListingStatus.Resolved) title = "Tapıldı ✓ " + title;

        // Təsvir: ilk 160 simvol + ünvan
        var description = (listing.Description ?? "").Trim();
        if (description.Length > 160) description = description[..160].TrimEnd() + "…";
        if (!string.IsNullOrWhiteSpace(listing.Address)) description += $" · {listing.Address}";

        // Şəkil: elanın ilk şəkli, yoxdursa standart şəkil
        var photo = listing.Photos.OrderBy(p => p.Id).FirstOrDefault();
        var imagePath = photo != null ? photo.Url : DefaultImage(listing);
        var imageUrl = $"{baseUrl}/{imagePath.TrimStart('/')}";
        var pageUrl = $"{baseUrl}/listing-detail.html?id={listing.Id}";

        static string E(string s) => WebUtility.HtmlEncode(s);

        var meta = new StringBuilder();
        meta.AppendLine("  <meta property=\"og:type\" content=\"website\">");
        meta.AppendLine("  <meta property=\"og:site_name\" content=\"Pawly\">");
        meta.AppendLine("  <meta property=\"og:locale\" content=\"az_AZ\">");
        meta.AppendLine($"  <meta property=\"og:title\" content=\"{E(title)}\">");
        meta.AppendLine($"  <meta property=\"og:description\" content=\"{E(description)}\">");
        meta.AppendLine($"  <meta property=\"og:image\" content=\"{E(imageUrl)}\">");
        meta.AppendLine($"  <meta property=\"og:url\" content=\"{E(pageUrl)}\">");
        meta.AppendLine("  <meta name=\"twitter:card\" content=\"summary_large_image\">");
        meta.AppendLine($"  <meta name=\"twitter:title\" content=\"{E(title)}\">");
        meta.AppendLine($"  <meta name=\"twitter:description\" content=\"{E(description)}\">");
        meta.AppendLine($"  <meta name=\"twitter:image\" content=\"{E(imageUrl)}\">");

        return html.Replace("</head>", meta + "</head>");
    }

    // Saytdakı standart şəkillərlə eyni qayda (api.js-dəki kimi)
    private static string DefaultImage(Listing listing) => listing.Type switch
    {
        ListingType.NeedsHelp => "images/dog-needs-care-1.jpg",
        ListingType.Lost => listing.AnimalKind == AnimalKind.Cat ? "images/cat-lost-1.jpg" : "images/dog-lost-1.jpg",
        _ => listing.AnimalKind == AnimalKind.Cat ? "images/cat-stray-1.jpg" : "images/dog-stray-1.jpg"
    };
}