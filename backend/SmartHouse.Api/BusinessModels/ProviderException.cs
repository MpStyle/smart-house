namespace SmartHouse.Api.BusinessModels;

/// <summary>Reports a provider failure with a safe API error code and HTTP status.</summary>
public sealed class ProviderException(string code, int status = 502) : Exception(code)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}
