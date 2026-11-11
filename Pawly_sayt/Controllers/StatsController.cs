using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pawly_sayt.Data;
using Pawly_sayt.Models;

namespace Pawly_sayt.Controllers;

// Ana səhifədəki statistika: bazadan real rəqəmlər
[ApiController]
[Route("api/stats")]
public class StatsController : ControllerBase
{
    private readonly AppDbContext _db;

    public StatsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        // Bloklanmış istifadəçilərin elanları sayılmır
        var visible = _db.Listings
            .AsNoTracking()
            .Where(l => l.User == null || !l.User.IsBlocked);

        var total = await visible.CountAsync();
        var reunited = await visible.CountAsync(l =>
            l.Type == ListingType.Lost && l.Status == ListingStatus.Resolved);
        var careReports = await visible.CountAsync(l => l.Type == ListingType.NeedsHelp);

        // Rəqəmlər tez-tez dəyişmir: brauzer 5 dəqiqə yadda saxlaya bilər
        Response.Headers.CacheControl = "public, max-age=300";

        return Ok(new { total, reunited, careReports });
    }
}