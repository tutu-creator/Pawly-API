using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pawly_sayt.Data;
using Pawly_sayt.Dtos;
using Pawly_sayt.Models;

namespace Pawly_sayt.Controllers;

[ApiController]
[Route("api/listings/{id:int}/report")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ReportsController(AppDbContext db)
    {
        _db = db;
    }

    // Elana şikayət göndərmək (yalnız daxil olmuş istifadəçi)
    [Authorize]
    [EnableRateLimiting("report")]
    [HttpPost]
    public async Task<IActionResult> Create(int id, CreateReportDto dto)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var listing = await _db.Listings.FindAsync(id);
        if (listing == null)
            return NotFound(new { message = "Elan tapılmadı." });

        if (listing.UserId == userId)
            return BadRequest(new { message = "Öz elanınıza şikayət edə bilməzsiniz." });

        if (await _db.ListingReports.AnyAsync(r => r.ListingId == id && r.UserId == userId))
            return Conflict(new { message = "Bu elana artıq şikayət göndərmisiniz." });

        _db.ListingReports.Add(new ListingReport
        {
            ListingId = id,
            UserId = userId,
            Reason = dto.Reason,
            Comment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim()
        });

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Eyni anda iki dəfə basılıbsa, baza ikincini rədd edir
            return Conflict(new { message = "Bu elana artıq şikayət göndərmisiniz." });
        }

        return Ok(new { message = "Şikayətiniz qəbul edildi. Təşəkkür edirik!" });
    }
}