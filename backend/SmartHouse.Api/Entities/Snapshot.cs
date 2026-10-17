namespace SmartHouse.Api.Entities;

/// <summary>Contains a home's retrieved readings, timezone, and update warnings.</summary>
public sealed record Snapshot(string HomeId, string Timezone, DateTimeOffset FetchedAt, Room[] Rooms, string[] Warnings);
