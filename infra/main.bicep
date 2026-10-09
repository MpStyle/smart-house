targetScope = 'resourceGroup'

@minLength(3)
@maxLength(18)
param appName string = 'smart-house'
param location string = 'westeurope'
@description('Static website hostname. Leave empty on the first deployment, enable the website, then redeploy with its hostname.')
param frontendWebHost string = ''
@description('Optional recipients for cost alerts. Amounts use the subscription billing currency, not necessarily EUR.')
param budgetEmails array = []
param monthlyBudget int = 100
param budgetStart string = utcNow('yyyy-MM-01')

var suffix = uniqueString(resourceGroup().id)
var compactName = replace(appName, '-', '')
var tags = { application: 'smart-house' }

resource frontend 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('${compactName}web${suffix}', 24)
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
  }
}
resource keyStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('${compactName}key${suffix}', 24)
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
  }
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: keyStorage
  name: 'default'
}
resource keyContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: 'keyring'
  properties: { publicAccess: 'None' }
}
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('${appName}-${suffix}', 24)
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 7
  }
}
resource encryptionKey 'Microsoft.KeyVault/vaults/keys@2023-07-01' = {
  parent: vault
  name: 'session-encryption'
  properties: {
    kty: 'RSA'
    keySize: 2048
    keyOps: ['wrapKey', 'unwrapKey']
    attributes: { enabled: true }
  }
}
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${appName}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: { name: 'B1', tier: 'Basic', capacity: 1 }
  properties: { reserved: true }
}
resource profile 'Microsoft.Cdn/profiles@2024-09-01' = {
  name: '${appName}-edge'
  location: 'global'
  tags: tags
  sku: { name: 'Standard_AzureFrontDoor' }
}
resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-09-01' = {
  parent: profile
  name: '${appName}-${suffix}'
  location: 'global'
  properties: { enabledState: 'Enabled' }
}
resource api 'Microsoft.Web/sites@2024-04-01' = {
  name: '${appName}-api-${suffix}'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
        { name: 'PublicOrigin', value: 'https://${endpoint.properties.hostName}' }
        { name: 'FrontDoorId', value: profile.properties.frontDoorId }
        { name: 'DataDirectory', value: '/home/data/smart-house' }
        { name: 'DataProtection__BlobUri', value: '${keyStorage.properties.primaryEndpoints.blob}keyring/keys.xml' }
        { name: 'DataProtection__KeyUri', value: '${vault.properties.vaultUri}keys/session-encryption' }
        { name: 'Netatmo__ClientId', value: '@Microsoft.KeyVault(SecretUri=${vault.properties.vaultUri}secrets/netatmo-client-id/)' }
        { name: 'Netatmo__ClientSecret', value: '@Microsoft.KeyVault(SecretUri=${vault.properties.vaultUri}secrets/netatmo-client-secret/)' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'true' }
      ]
      ipSecurityRestrictionsDefaultAction: 'Deny'
      ipSecurityRestrictions: [
        {
          name: 'FrontDoorOnly'
          priority: 100
          action: 'Allow'
          tag: 'ServiceTag'
          ipAddress: 'AzureFrontDoor.Backend'
          headers: { 'x-azure-fdid': [profile.properties.frontDoorId] }
        }
      ]
      scmIpSecurityRestrictionsUseMain: false
    }
  }
}
resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyStorage.id, api.id, 'blob-contributor')
  scope: keyStorage
  properties: {
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  }
}
resource secretRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, api.id, 'secret-reader')
  scope: vault
  properties: {
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}
resource cryptoRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, api.id, 'key-encryption')
  scope: vault
  properties: {
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'e147488a-f6f5-4113-8e2d-b22465e65bf6')
  }
}
resource apiGroup 'Microsoft.Cdn/profiles/originGroups@2024-09-01' = {
  parent: profile
  name: 'api'
  properties: {
    loadBalancingSettings: { sampleSize: 4, successfulSamplesRequired: 3, additionalLatencyInMilliseconds: 50 }
    healthProbeSettings: { probePath: '/api/health', probeProtocol: 'Https', probeRequestType: 'GET', probeIntervalInSeconds: 120 }
  }
}
resource apiOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-09-01' = {
  parent: apiGroup
  name: 'app-service'
  properties: {
    hostName: api.properties.defaultHostName
    originHostHeader: api.properties.defaultHostName
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}
resource headers 'Microsoft.Cdn/profiles/ruleSets@2024-09-01' = {
  parent: profile
  name: 'SecurityHeaders'
}
resource headerRule 'Microsoft.Cdn/profiles/ruleSets/rules@2024-09-01' = {
  parent: headers
  name: 'SecureBrowser'
  properties: {
    order: 1
    conditions: []
    actions: [
      { name: 'ModifyResponseHeader', parameters: { typeName: 'DeliveryRuleHeaderActionParameters', headerAction: 'Overwrite', headerName: 'X-Content-Type-Options', value: 'nosniff' } }
      { name: 'ModifyResponseHeader', parameters: { typeName: 'DeliveryRuleHeaderActionParameters', headerAction: 'Overwrite', headerName: 'Referrer-Policy', value: 'no-referrer' } }
      { name: 'ModifyResponseHeader', parameters: { typeName: 'DeliveryRuleHeaderActionParameters', headerAction: 'Overwrite', headerName: 'Strict-Transport-Security', value: 'max-age=31536000' } }
      { name: 'ModifyResponseHeader', parameters: { typeName: 'DeliveryRuleHeaderActionParameters', headerAction: 'Overwrite', headerName: 'Content-Security-Policy', value: 'default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\'; connect-src \'self\'; frame-ancestors \'none\'; base-uri \'self\'; form-action \'self\' https://api.netatmo.com' } }
    ]
  }
}
resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-09-01' = {
  parent: endpoint
  name: 'api'
  dependsOn: [apiOrigin, headerRule]
  properties: {
    originGroup: { id: apiGroup.id }
    patternsToMatch: ['/api/*']
    supportedProtocols: ['Http', 'Https']
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
    enabledState: 'Enabled'
    ruleSets: [{ id: headers.id }]
  }
}
resource frontendGroup 'Microsoft.Cdn/profiles/originGroups@2024-09-01' = if (!empty(frontendWebHost)) {
  parent: profile
  name: 'frontend'
  properties: {
    loadBalancingSettings: { sampleSize: 4, successfulSamplesRequired: 3, additionalLatencyInMilliseconds: 50 }
    healthProbeSettings: { probePath: '/', probeProtocol: 'Https', probeRequestType: 'HEAD', probeIntervalInSeconds: 120 }
  }
}
resource frontendOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-09-01' = if (!empty(frontendWebHost)) {
  parent: frontendGroup
  name: 'storage-website'
  properties: {
    hostName: frontendWebHost
    originHostHeader: frontendWebHost
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}
resource frontendRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-09-01' = if (!empty(frontendWebHost)) {
  parent: endpoint
  name: 'frontend'
  dependsOn: [frontendOrigin, headerRule]
  properties: {
    originGroup: { id: frontendGroup.id }
    patternsToMatch: ['/*']
    supportedProtocols: ['Http', 'Https']
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
    enabledState: 'Enabled'
    ruleSets: [{ id: headers.id }]
    cacheConfiguration: {
      queryStringCachingBehavior: 'UseQueryString'
      compressionSettings: {
        isCompressionEnabled: true
        contentTypesToCompress: ['text/html', 'text/css', 'application/javascript', 'application/json', 'image/svg+xml']
      }
    }
  }
}
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = if (!empty(budgetEmails)) {
  name: '${appName}-monthly'
  properties: {
    category: 'Cost'
    amount: monthlyBudget
    timeGrain: 'Monthly'
    timePeriod: { startDate: '${budgetStart}T00:00:00Z' }
    notifications: {
      Actual80: { enabled: true, operator: 'GreaterThan', threshold: 80, contactEmails: budgetEmails, contactRoles: [], contactGroups: [], thresholdType: 'Actual' }
      Forecast100: { enabled: true, operator: 'GreaterThan', threshold: 100, contactEmails: budgetEmails, contactRoles: [], contactGroups: [], thresholdType: 'Forecasted' }
    }
  }
}

output frontendStorage string = frontend.name
output apiName string = api.name
output keyVaultName string = vault.name
output frontDoorProfile string = profile.name
output frontDoorEndpoint string = endpoint.name
output publicUrl string = 'https://${endpoint.properties.hostName}'
output netatmoCallback string = 'https://${endpoint.properties.hostName}/api/auth/callback'
