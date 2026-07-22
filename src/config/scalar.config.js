/**
 * Constrói as configurações do <ApiReference> a partir da estrutura
 * disponibilizada em portal.config.json.
 */

export function buildScalarSources(portalConfig, baseUrl = '/') {
  const variable = portalConfig.sharedTokenVariable;
  return portalConfig.apis.map((api) => {
    const source = {
      title: api.title,
      slug: api.slug,
      url: `${baseUrl}openapi/${api.id}.json`,
      default: Boolean(api.default),
    };

    if (api.securityScheme) {
      source.authentication = {
        preferredSecurityScheme: api.securityScheme,
        securitySchemes: { [api.securityScheme]: { token: `{{${variable}}}` } },
      };
    } else if (api.securitySchemes) {
      const securitySchemes = {};
      for (const scheme of api.securitySchemes) {
        if (scheme.prefill) securitySchemes[scheme.name] = scheme.prefill;
      }
      source.authentication = {
        preferredSecurityScheme: null,
        securitySchemes,
      };
    }

    return source;
  });
}

export function buildScalarConfiguration(portalConfig, baseUrl = '/', { plugins = [] } = {}) {
  return {
    sources: buildScalarSources(portalConfig, baseUrl),
    plugins,

    theme: 'fastify',
    layout: 'modern',
    hideModels: true,
    hideClientButton: true,
    persistAuth: true,
    showDeveloperTools: 'localhost',
    showToolbar: 'localhost',
    telemetry: true,
    operationTitleSource: 'summary',
    orderSchemaPropertiesBy: 'alpha',
    orderRequiredPropertiesFirst: true,
    documentDownloadType: 'both',
    withDefaultFonts: true,
    hideSearch: false,
    showSidebar: true,

    metaData: {
      title: `Portal do Desenvolvedor — SCI${portalConfig.environment === 'homolog' ? ' (Homologação)' : ''}`,
      description: 'Documentação oficial das APIs da SCI.',
      ogTitle: 'Portal do Desenvolvedor — SCI',
      ogDescription: 'Documentação oficial das APIs da SCI.',
    },
  };
}