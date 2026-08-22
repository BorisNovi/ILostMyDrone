namespace LostDroneApi.Models;

public class Session
{
    public required string Id { get; init; }
    public required string CreatorToken { get; init; }
    public required double TargetLatitude { get; init; }
    public required double TargetLongitude { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
