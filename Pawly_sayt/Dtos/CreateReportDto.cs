using System.ComponentModel.DataAnnotations;
using Pawly_sayt.Models;

namespace Pawly_sayt.Dtos;

public class CreateReportDto
{
    [EnumDataType(typeof(ReportReason))]   // yalnız siyahıdakı səbəblər qəbul olunur
    public ReportReason Reason { get; set; }

    [MaxLength(500)]
    public string? Comment { get; set; }
}