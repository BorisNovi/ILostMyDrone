namespace LostDroneApi.Models;

public class CheckedCell
{
    public required string SessionId { get; init; }
    public required int CellX { get; init; }
    public required int CellY { get; init; }
    public required string Color { get; set; }
}
