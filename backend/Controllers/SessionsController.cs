using System.Security.Cryptography;
using LostDroneApi.Data;
using LostDroneApi.Dtos;
using LostDroneApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace LostDroneApi.Controllers;

[ApiController]
[Route("api/sessions")]
public class SessionsController(AppDbContext db) : ControllerBase
{
    private const string SessionIdAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private const int SessionIdLength = 10;
    private const string MasterTokenAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private const int MasterTokenLength = 32;

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

    [HttpGet("{id}")]
    [EnableRateLimiting("read")]
    public async Task<ActionResult<SessionResponse>> Get(string id)
    {
        var session = await db.Sessions.FindAsync(id);

        if (session is null)
            return NotFound();

        return new SessionResponse(session.Id, session.TargetLatitude, session.TargetLongitude);
    }

    [HttpDelete("{id}")]
    [EnableRateLimiting("read")]
    public async Task<IActionResult> Delete(string id, [FromHeader(Name = "X-Master-Token")] string? masterToken)
    {
        var session = await db.Sessions.FindAsync(id);

        if (session is null)
            return NotFound();

        if (masterToken is null || session.MasterToken != masterToken)
            return StatusCode(StatusCodes.Status403Forbidden);

        db.Sessions.Remove(session);
        await db.SaveChangesAsync();

        return NoContent();
    }
}
