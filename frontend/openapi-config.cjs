module.exports = {
  schemaFile: '../openapi/smart-house.json',
  apiFile: './src/api/baseApi.ts',
  apiImport: 'baseApi',
  outputFile: './src/api/generated.ts',
  exportName: 'generatedApi',
  hooks: true,
  encodePathParams: true,
  flattenArg: true,
};
