using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TealHunt.Domain.Entities;

public class IocAuditLog
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(500)]
    public string IndicatorValue { get; set; }

    [Required]
    [MaxLength(50)]
    public string IndicatorType { get; set; } // IP, Domain, Hash, URL, CVE

    public int RiskScore { get; set; } // 0-100

    [Column(TypeName = "jsonb")]
    public string RawResultJson { get; set; } // The aggregated JSON result

    public DateTime QueriedAt { get; set; } = DateTime.UtcNow;

    public string QueriedByUserId { get; set; } // Optional user tracking

    public AppUser QueriedByUser { get; set; }
}
