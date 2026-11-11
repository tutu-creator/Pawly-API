using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pawly_sayt.Data;
using Pawly_sayt.Models;

namespace Pawly_sayt.Controllers;

// Bu controller-ə yalnız Admin rolu olanlar girə bilər.
// Adi istifadəçi sorğu göndərsə, server 403 (icazə yoxdur) qaytarır.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public AdminController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Şikayətlərin siyahısı. ?status=open → yalnız baxılmayanlar, ?status=all → hamısı
    [HttpGet("reports")]
    public async Task<IActionResult> GetReports([FromQuery] string status = "open")
    {
        var query = _db.ListingReports.AsQueryable();
        if (status == "open") query = query.Where(r => r.Status == ReportStatus.Open);

        var reports = await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                reason = r.Reason.ToString(),
                r.Comment,
                status = r.Status.ToString(),
                r.CreatedAt,
                // Bu elana cəmi neçə şikayət gəlib
                reportCount = _db.ListingReports.Count(x => x.ListingId == r.ListingId),
                reporter = new { r.User!.Id, r.User.FullName, r.User.Email },
                listing = new
                {
                    r.Listing!.Id,
                    r.Listing.Title,
                    r.Listing.Description,
                    type = r.Listing.Type.ToString(),
                    status = r.Listing.Status.ToString(),
                    owner = r.Listing.User == null ? null : new
                    {
                        r.Listing.User.Id,
                        r.Listing.User.FullName,
                        r.Listing.User.Email,
                        r.Listing.User.IsBlocked
                    }
                }
            })
            .ToListAsync();

        return Ok(reports);
    }

    // Şikayəti "baxıldı" kimi işarələ
    [HttpPost("reports/{id:int}/review")]
    public async Task<IActionResult> ReviewReport(int id)
    {
        var report = await _db.ListingReports.FindAsync(id);
        if (report == null) return NotFound(new { message = "Şikayət tapılmadı." });

        report.Status = ReportStatus.Reviewed;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // İstənilən elanı sil (şikayətləri də avtomatik silinir)
    [HttpDelete("listings/{id:int}")]
    public async Task<IActionResult> DeleteListing(int id)
    {
        var listing = await _db.Listings
            .Include(l => l.Photos)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (listing == null) return NotFound(new { message = "Elan tapılmadı." });

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

    // İstifadəçini blokla
    [HttpPost("users/{id:int}/block")]
    public async Task<IActionResult> BlockUser(int id)
    {
        if (id == CurrentUserId)
            return BadRequest(new { message = "Özünüzü bloklaya bilməzsiniz." });

        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = "İstifadəçi tapılmadı." });
        if (user.Role == UserRole.Admin)
            return BadRequest(new { message = "Admini bloklamaq olmaz." });

        user.IsBlocked = true;
        user.TokenVersion++;   // açıq olan bütün girişlərini dərhal bağlayırıq
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Bloku götür
    [HttpPost("users/{id:int}/unblock")]
    public async Task<IActionResult> UnblockUser(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = "İstifadəçi tapılmadı." });

        user.IsBlocked = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}