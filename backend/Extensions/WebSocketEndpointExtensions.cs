using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using LostDroneApi.Data;
using LostDroneApi.Dtos;
using LostDroneApi.Infrastructure;
using LostDroneApi.Models;

namespace LostDroneApi.Extensions;

public static class WebSocketEndpointExtensions
{
    /// <summary>
    /// Maps the live-session WebSocket endpoint (GET /api/sessions/{id}/ws). Handles the upgrade
    /// handshake, assigns the connecting socket a color (master if ?masterToken= matches the
    /// session, otherwise next free slave color), sends it that color, broadcasts
    /// participantJoined/Left to the rest of the session, and processes incoming tapCell
    /// messages — applying the tap rule (own cell unmarks, other/empty cell gets your color),
    /// persisting to CheckedCells, and broadcasting the resulting cellChanged to everyone.
    /// </summary>
    public static WebApplication MapSessionWebSocket(this WebApplication app)
    {
        app.Map("/api/sessions/{id}/ws", async (
            HttpContext context,
            string id,
            AppDbContext db,
            SessionSocketRegistry registry) =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            var session = await db.Sessions.FindAsync(id);

            if (session is null)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            var masterToken = context.Request.Query["masterToken"].ToString();
            var isMaster = !string.IsNullOrEmpty(masterToken) && masterToken == session.MasterToken;

            using var socket = await context.WebSockets.AcceptWebSocketAsync();

            var join = registry.TryAssignColor(id, socket, isMaster);

            if (join.Color is null)
            {
                await socket.CloseAsync(WebSocketCloseStatus.PolicyViolation, join.DenialReason, CancellationToken.None);
                return;
            }

            var color = join.Color;

            await SessionSocketRegistry.SendAsync(socket, new { type = "joined", color });
            await registry.BroadcastAsync(id, new { type = "participantJoined", color }, exclude: socket);

            var buffer = new byte[4096];

            try
            {
                while (socket.State == WebSocketState.Open)
                {
                    var result = await socket.ReceiveAsync(buffer, CancellationToken.None);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
                        break;
                    }

                    if (result.MessageType != WebSocketMessageType.Text)
                        continue;

                    var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    var incoming = JsonSerializer.Deserialize<TapCellMessage>(json, SessionSocketRegistry.JsonOptions);

                    if (incoming is null || incoming.Type != "tapCell")
                        continue;

                    var cell = await db.CheckedCells.FindAsync(id, incoming.CellX, incoming.CellY);
                    string? newColor;

                    if (cell is not null && cell.Color == color)
                    {
                        db.CheckedCells.Remove(cell);
                        newColor = null;
                    }
                    else if (cell is not null)
                    {
                        cell.Color = color;
                        newColor = color;
                    }
                    else
                    {
                        db.CheckedCells.Add(new CheckedCell
                        {
                            SessionId = id,
                            CellX = incoming.CellX,
                            CellY = incoming.CellY,
                            Color = color,
                        });
                        newColor = color;
                    }

                    await db.SaveChangesAsync();

                    await registry.BroadcastAsync(id, new
                    {
                        type = "cellChanged",
                        cellX = incoming.CellX,
                        cellY = incoming.CellY,
                        color = newColor,
                    });
                }
            }
            catch (WebSocketException)
            {
                // Connection dropped without a clean close handshake (network loss, app backgrounded) — expected, not an error.
            }
            finally
            {
                registry.Remove(id, socket);
                await registry.BroadcastAsync(id, new { type = "participantLeft", color });
            }
        });

        return app;
    }
}
