namespace SmartHouse.Api.Entities;

public sealed record Snapshot(string HomeId, string Timezone, DateTimeOffset FetchedAt, Room[] Rooms, string[] Warnings);
