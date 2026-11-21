using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace LostDroneApi.Infrastructure;

public readonly record struct JoinResult(string? Color, string? DenialReason);

public sealed class SessionSocketRegistry
{
    public const string MasterColor = "2ecc71";

    private static readonly string[] SlaveColors =
    [
        "e74c3c", "3498db", "f1c40f", "9b59b6",
        "e67e22", "1abc9c", "e84393", "34495e", "d35400",
    ];

    private sealed class SessionState
    {
        public readonly ConcurrentDictionary<WebSocket, string> ColorBySocket = new();
    }

    private readonly ConcurrentDictionary<string, SessionState> _sessions = new();

    public JoinResult TryAssignColor(string sessionId, WebSocket socket, bool isMaster)
    {
        var state = _sessions.GetOrAdd(sessionId, _ => new SessionState());

        lock (state)
        {
            var takenColors = state.ColorBySocket.Values.ToHashSet();

            if (isMaster)
            {
                if (takenColors.Contains(MasterColor))
                    return new JoinResult(null, "Master is already connected to this session");

                state.ColorBySocket[socket] = MasterColor;
                return new JoinResult(MasterColor, null);
            }

            var color = SlaveColors.FirstOrDefault(c => !takenColors.Contains(c));

            if (color is null)
                return new JoinResult(null, "Session already has the maximum number of slaves");

            state.ColorBySocket[socket] = color;
            return new JoinResult(color, null);
        }
    }

    public void Remove(string sessionId, WebSocket socket)
    {
        if (_sessions.TryGetValue(sessionId, out var state))
            state.ColorBySocket.TryRemove(socket, out _);
    }

    public async Task BroadcastAsync(string sessionId, object message, WebSocket? exclude = null)
    {
        if (!_sessions.TryGetValue(sessionId, out var state))
            return;

        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message));

        foreach (var socket in state.ColorBySocket.Keys)
        {
            if (socket == exclude || socket.State != WebSocketState.Open)
                continue;

            await socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}
