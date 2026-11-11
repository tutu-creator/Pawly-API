using System.Security.Claims;
using ImageMagick;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pawly_sayt.Data;
using Pawly_sayt.Dtos;
using Pawly_sayt.Models;

namespace Pawly_sayt.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ListingsController : ControllerBase
{
    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif" };
    private const int MaxFiles = 5;
    private const long MaxFileSize = 10 * 1024 * 1024; // 10 MB
    private const int MaxPhotoDimension = 1600;         // HEIC çevriləndə ən uzun tərəf (piksel)

    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ListingsController> _logger;

    public ListingsController(AppDbContext db, IWebHostEnvironment env, ILogger<ListingsController> logger)
    {
        _db = db;
        _env = env;
        _logger = logger;
    }

    // Token-dən daxil olmuş istifadəçinin nömrəsini götürür
    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Faylın ilk baytlarına baxıb həqiqətən şəkil olub-olmadığını yoxlayır.
    // Şəkildirsə düzgün uzantını, deyilsə null qaytarır.
    private static async Task<string?> DetectImageExtension(IFormFile file)
    {
        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false);

        // JPEG: FF D8 FF
        if (read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return ".jpg";

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
            && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
            return ".png";

        // WEBP: "RIFF" .... "WEBP"
        if (read >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
            && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P')
            return ".webp";

        // HEIC/HEIF (iPhone şəkilləri): 4-cü baytdan "ftyp", sonra format adı
        if (read >= 12 && System.Text.Encoding.ASCII.GetString(header, 4, 4) == "ftyp")
        {
            var brand = System.Text.Encoding.ASCII.GetString(header, 8, 4);
            if (brand is "heic" or "heix" or "hevc" or "hevx" or "mif1" or "msf1")
                return ".heic";
        }

        return null;
    }

    // HEIC şəkli JPEG-ə çevirir: düzgün istiqamətə çevirir, kiçildir,
    // içindəki gizli məlumatları (GPS və s.) silir.
    // Yalnız HEIC formatında açır, başqa formatları bu kitabxana ilə emal etmirik.
    private static async Task ConvertHeicToJpeg(IFormFile file, string targetPath)
    {
        await using var input = file.OpenReadStream();
        using var image = new MagickImage(input, MagickFormat.Heic);

        image.AutoOrient();
        image.Resize(new MagickGeometry(MaxPhotoDimension, MaxPhotoDimension) { Greater = true });
        image.Strip();
        image.Quality = 85;

        await image.WriteAsync(targetPath, MagickFormat.Jpeg);
    }

    // Aktiv elanlar: axtarış, filtr, çeşidləmə və səhifələmə serverdə edilir.
    // Nümunə: /api/listings?type=Lost&animalKind=Dog&search=Yasamal&sort=newest&page=1&pageSize=12
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] ListingType? type,
        [FromQuery] AnimalKind? animalKind,
        [FromQuery] string? city,
        [FromQuery] string? search,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12)
    {
        // Səhv və ya çox böyük dəyərlərə qarşı qoruma
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Listings
            .AsNoTracking()
            .Where(l => l.Status == ListingStatus.Active)
            .Where(l => l.User == null || !l.User.IsBlocked);   // bloklananların elanları görünmür

        if (type.HasValue) query = query.Where(l => l.Type == type.Value);
        if (animalKind.HasValue) query = query.Where(l => l.AnimalKind == animalKind.Value);
        if (!string.IsNullOrWhiteSpace(city)) query = query.Where(l => l.City == city);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            if (q.Length > 100) q = q[..100];   // çox uzun axtarış mətni lazım deyil

            query = query.Where(l =>
                l.Description.Contains(q) ||
                (l.Title != null && l.Title.Contains(q)) ||
                (l.Address != null && l.Address.Contains(q)) ||
                (l.PetName != null && l.PetName.Contains(q)) ||
                l.City.Contains(q));
        }

        // Cəmi neçə elan uyğun gəlir (səhifədə "Cəmi X elan" üçün)
        var total = await query.CountAsync();

        query = sort == "oldest"
            ? query.OrderBy(l => l.CreatedAt).ThenBy(l => l.Id)
            : query.OrderByDescending(l => l.CreatedAt).ThenByDescending(l => l.Id);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(l => l.Photos)
            .ToListAsync();

        return Ok(new { items, total, page, pageSize });
    }

    // Yalnız mənim elanlarım (aktiv və tapılmış, giriş lazımdır)
    [Authorize]
    [HttpGet("mine")]
    public async Task<ActionResult<List<Listing>>> GetMine()
    {
        var userId = CurrentUserId;
        return await _db.Listings
            .Include(l => l.Photos)
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();
    }

    // Tək elan (hamı görə bilər)
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Listing>> GetById(int id)
    {
        var listing = await _db.Listings
            .Include(l => l.Photos)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (listing == null) return NotFound();
        return listing;
    }

    // Yeni elan (giriş məcburidir)
    [Authorize]
    [HttpPost]
    public async Task<ActionResult<Listing>> Create(CreateListingDto dto)
    {
        // E-poçtunu təsdiqləməyən istifadəçi elan yerləşdirə bilməz
        var currentUser = await _db.Users.FindAsync(CurrentUserId);
        if (currentUser == null || !currentUser.EmailConfirmed)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "Elan yerləşdirmək üçün əvvəlcə e-poçtunuzu təsdiqləyin." });
        }
        
        var listing = new Listing
        {
            UserId = CurrentUserId,
            Type = dto.Type,
            AnimalKind = dto.AnimalKind,
            Title = dto.Title,
            PetName = dto.PetName,
            Breed = dto.Breed,
            Age = dto.Age,
            Color = dto.Color,
            LostDate = dto.LostDate,
            ObservedDuration = dto.ObservedDuration,
            Conditions = dto.Conditions is { Count: > 0 }
                ? string.Join("|", dto.Conditions)
                : null,
            Description = dto.Description,
            City = dto.City,
            Address = dto.Address,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            ContactInfo = dto.ContactInfo
        };

        _db.Listings.Add(listing);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = listing.Id }, listing);
    }

    // Elana şəkil əlavə et (yalnız elanın sahibi)
    [Authorize]
    [HttpPost("{id:int}/photos")]
    [RequestSizeLimit(60_000_000)]
    public async Task<IActionResult> UploadPhotos(int id, List<IFormFile> files)
    {
        var listing = await _db.Listings.FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null) return NotFound();
        if (listing.UserId != CurrentUserId) return Forbid();

        if (files == null || files.Count == 0)
            return BadRequest(new { message = "Şəkil seçilməyib." });
        if (files.Count > MaxFiles)
            return BadRequest(new { message = $"Ən çox {MaxFiles} şəkil yükləmək olar." });

        // Əvvəl hamısını yoxlayırıq: ad, ölçü və faylın İÇİ
        var checkedFiles = new List<(IFormFile File, string Ext)>();
        foreach (var file in files)
        {
            var nameExt = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(nameExt))
                return BadRequest(new { message = "Yalnız .jpg, .jpeg, .png, .webp, .heic qəbul edilir." });
            if (file.Length == 0 || file.Length > MaxFileSize)
                return BadRequest(new { message = "Şəkil 10 MB-dan böyük ola bilməz." });

            var realExt = await DetectImageExtension(file);
            if (realExt == null)
                return BadRequest(new { message = $"\"{file.FileName}\" əsl şəkil faylı deyil." });

            checkedFiles.Add((file, realExt));
        }

        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");
        Directory.CreateDirectory(uploadsFolder);

        var saved = new List<ListingPhoto>();
        var writtenFiles = new List<string>();   // xəta olarsa, bu sorğuda yazılanları silmək üçün

        foreach (var (file, ext) in checkedFiles)
        {
            // HEIC şəkillər JPEG kimi saxlanılır
            var finalExt = ext == ".heic" ? ".jpg" : ext;

            // Faylın adını istifadəçidən götürmürük, özümüz yaradırıq
            var fileName = $"{Guid.NewGuid()}{finalExt}";
            var filePath = Path.Combine(uploadsFolder, fileName);

            if (ext == ".heic")
            {
                try
                {
                    await ConvertHeicToJpeg(file, filePath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "HEIC şəkil çevrilmədi: {File}", file.FileName);

                    // Bu sorğuda artıq yazılmış faylları silirik ki, yarımçıq fayl qalmasın
                    foreach (var path in writtenFiles.Append(filePath))
                    {
                        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
                    }

                    return BadRequest(new { message = $"\"{file.FileName}\" açıla bilmədi. JPG və ya PNG formatında şəkil seçin." });
                }
            }
            else
            {
                await using var stream = System.IO.File.Create(filePath);
                await file.CopyToAsync(stream);
            }

            writtenFiles.Add(filePath);

            var photo = new ListingPhoto { ListingId = listing.Id, Url = $"uploads/{fileName}" };
            _db.ListingPhotos.Add(photo);
            saved.Add(photo);
        }

        await _db.SaveChangesAsync();
        return Ok(saved);
    }

    // "Tapıldı" kimi işarələ (yalnız elanın sahibi)
    [Authorize]
    [HttpPost("{id:int}/resolve")]
    public async Task<IActionResult> Resolve(int id)
    {
        var listing = await _db.Listings.FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null) return NotFound();
        if (listing.UserId != CurrentUserId) return Forbid();

        listing.Status = ListingStatus.Resolved;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Elanı sil (yalnız elanın sahibi)
    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var listing = await _db.Listings
            .Include(l => l.Photos)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (listing == null) return NotFound();
        if (listing.UserId != CurrentUserId) return Forbid();

        // Şəkil fayllarını da diskdən silirik
        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");
        foreach (var photo in listing.Photos)
        {
            var path = Path.Combine(uploadsFolder, Path.GetFileName(photo.Url));
            if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
        }

        _db.Listings.Remove(listing);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}