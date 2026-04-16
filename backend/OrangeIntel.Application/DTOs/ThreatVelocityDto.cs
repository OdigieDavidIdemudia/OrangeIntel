namespace OrangeIntel.Application.DTOs;

public class ThreatVelocityDto
{
    public string Status { get; set; } = "Normal"; // Normal, SpikeDetected
    public double BaselineRate { get; set; }
    public double CurrentRate { get; set; }
}
