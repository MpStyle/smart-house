namespace SmartHouse.Api.BusinessModels;

public sealed class ProviderException(string code, int status = 502) : Exception(code)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}
