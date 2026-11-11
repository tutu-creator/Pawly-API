using Microsoft.AspNetCore.Mvc;
using Pawly_sayt.Data;
using Pawly_sayt.Dtos;
using Pawly_sayt.Models;

namespace Pawly_sayt.Controllers;

[ApiController]
[Route("api/volunteer")]
public class VolunteerController : ControllerBase
{
    private readonly AppDbContext _db;

    public VolunteerController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateVolunteerApplicationDto dto)
    {
        var application = new VolunteerApplication
        {
            FullName = dto.FullName.Trim(),
            Email = dto.Email.Trim(),
            Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
            Purpose = dto.Purpose.Trim(),
            Message = dto.Message.Trim()
        };

        _db.VolunteerApplications.Add(application);
        await _db.SaveChangesAsync();

        return Ok(new { id = application.Id });
    }
}