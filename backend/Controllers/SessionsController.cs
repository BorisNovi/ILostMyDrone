using System.Security.Cryptography;
using LostDroneApi.Data;
using LostDroneApi.Dtos;
using LostDroneApi.Infrastructure;
using LostDroneApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace LostDroneApi.Controllers;

[ApiController]
[Route("api/sessions")]
public class SessionsController(AppDbContext db, SessionSocketRegistry registry) : ControllerBase
{
    private const string SessionIdAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private const int SessionIdLength = 10;
    private const string MasterTokenAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private const int MasterTokenLength = 32;

    /// <summary>
    /// Creates a new live search session. Returns the public session id (for sharing)
    /// and a master token (kept only by the creator, used to authorize deletion and WS master role).
    /// </summary>
    [HttpPost]
    [EnableRateLimiting("create")]
    public async Task<ActionResult<CreateSessionResponse>> Create(CreateSessionRequest request)
    {
        var session = new Session
        {
            Id = RandomNumberGenerator.GetString(SessionIdAlphabet, SessionIdLength),
            MasterToken = RandomNumberGenerator.GetString(MasterTokenAlphabet, MasterTokenLength),
            TargetLatitude = request.TargetLatitude,
            TargetLongitude = request.TargetLongitude,
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync();

        return CreatedAtAction(
            nameof(Get),
            new { id = session.Id },
            new CreateSessionResponse(session.Id, session.MasterToken));
    }

    /// <summary>
    /// Returns a public snapshot of the session (target coordinates), without the master token.
    /// Used on initial join and on reconnect to resync state.
    /// </summary>
    [HttpGet("{id}")]
    [EnableRateLimiting("read")]
    public async Task<ActionResult<SessionResponse>> Get(string id)
    {
        var session = await db.Sessions.FindAsync(id);

        if (session is null)
            return NotFound();

        return new SessionResponse(session.Id, session.TargetLatitude, session.TargetLongitude);
    }

    /// <summary>
    /// Permanently deletes a session and its checked cells (cascade), only if the caller
    /// presents the matching master token via the X-Master-Token header. Notifies any
    /// currently connected WebSocket clients with a sessionDestroyed message, then closes
    /// their sockets once the session is deleted.
    /// </summary>
    [HttpDelete("{id}")]
    [EnableRateLimiting("read")]
    public async Task<IActionResult> Delete(string id, [FromHeader(Name = "X-Master-Token")] string? masterToken)
    {
        var session = await db.Sessions.FindAsync(id);

        if (session is null)
            return NotFound();

        if (masterToken is null || session.MasterToken != masterToken)
            return StatusCode(StatusCodes.Status403Forbidden);

        await registry.BroadcastAsync(id, new { type = "sessionDestroyed" });

        db.Sessions.Remove(session);
        await db.SaveChangesAsync();

        await registry.CloseAllAsync(id, "Session deleted");

        return NoContent();
    }
}
