using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace LostDroneApi.Infrastructure;

/// <summary>
/// Result of a connection attempt: either an assigned <see cref="Color"/>, or a
/// <see cref="DenialReason"/> explaining why the socket was refused (slot taken, session full).
/// </summary>
public readonly record struct JoinResult(string? Color, string? DenialReason);

public sealed class SessionSocketRegistry
{
    public const string MasterColor = "2ecc71";

    public static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

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

    /// <summary>
    /// Tries to assign a color to a newly connected socket for the given session: the fixed
    /// master color if <paramref name="isMaster"/> and free, otherwise the first free slave color.
    /// Returns a denial reason instead if the requested slot is already taken.
    /// </summary>
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

    /// <summary>
    /// Unregisters a socket from a session, freeing its color for future joiners.
    /// Call on disconnect (clean close or dropped connection).
    /// </summary>
    public void Remove(string sessionId, WebSocket socket)
    {
        if (_sessions.TryGetValue(sessionId, out var state))
            state.ColorBySocket.TryRemove(socket, out _);
    }

    /// <summary>
    /// Serializes <paramref name="message"/> once and sends it to every currently open socket
    /// in the session, optionally skipping <paramref name="exclude"/> (e.g. the sender itself).
    /// </summary>
    public async Task BroadcastAsync(string sessionId, object message, WebSocket? exclude = null)
    {
        if (!_sessions.TryGetValue(sessionId, out var state))
            return;

        var bytes = SerializeToBytes(message);

        foreach (var socket in state.ColorBySocket.Keys)
        {
            if (socket == exclude || socket.State != WebSocketState.Open)
                continue;

            await socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }

    /// <summary>
    /// Closes every currently open socket in the session with a normal-closure handshake.
    /// Call after the session itself has been deleted, so no clients are left talking to
    /// a session that no longer exists.
    /// </summary>
    public async Task CloseAllAsync(string sessionId, string? description = null)
    {
        if (!_sessions.TryGetValue(sessionId, out var state))
            return;

        foreach (var socket in state.ColorBySocket.Keys)
        {
            if (socket.State != WebSocketState.Open)
                continue;

            await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, description, CancellationToken.None);
        }
    }

    /// <summary>
    /// Sends <paramref name="message"/> to a single socket, bypassing session broadcast.
    /// Used to tell a participant its own assigned color right after it connects.
    /// </summary>
    public static async Task SendAsync(WebSocket socket, object message)
    {
        if (socket.State != WebSocketState.Open)
            return;

        await socket.SendAsync(SerializeToBytes(message), WebSocketMessageType.Text, true, CancellationToken.None);
    }

    private static byte[] SerializeToBytes(object message) =>
        Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message, JsonOptions));
}
