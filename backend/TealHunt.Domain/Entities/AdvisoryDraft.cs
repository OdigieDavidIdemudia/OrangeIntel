using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TealHunt.Domain.Entities;

public class AdvisoryDraft
{
    [Key]
    public Guid Id { get; set; }

    public Guid? TopicId { get; set; }

    [Required]
    public string AuthorId { get; set; } = string.Empty;

    [Column(TypeName = "jsonb")]
    public string ContentJson { get; set; } = "{}";

    public int Version { get; set; } = 1;

    public DateTime LastSavedAt { get; set; } = DateTime.UtcNow;
}
