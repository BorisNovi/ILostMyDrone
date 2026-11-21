using System.Net.WebSockets;
using LostDroneApi.Data;
using LostDroneApi.Infrastructure;

namespace LostDroneApi.Extensions;

public static class WebSocketEndpointExtensions
{
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

                    // Cell-tap message handling lands here in the next step.
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
