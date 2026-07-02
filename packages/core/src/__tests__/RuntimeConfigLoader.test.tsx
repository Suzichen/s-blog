import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RuntimeConfigLoader } from '../RuntimeConfigLoader';
import type { RuntimeSiteConfig } from '../RuntimeConfigLoader';
import type { AlbumConfig } from '../types/album-config';

// Valid mock configurations
const validSiteConfig: RuntimeSiteConfig = {
  title: 'Test Blog',
  description: 'A test blog description',
  logo: '/logo.png',
  favicon: '/favicon.ico',
  siteUrl: 'https://example.com',
  author: 'Test Author',
  language: 'en',
  timezone: 'UTC',
  basePath: '/',
};

const validAlbumConfig: AlbumConfig = {
  enabled: true,
  albums: [
    { dir: 'travel', name: 'Travel Photos' },
    { dir: 'nature' },
  ],
};

// Helper to create mock fetch responses
function createMockResponse(data: unknown, ok = true, status = 200, statusText = 'OK'): Response {
  return {
    ok,
    status,
    statusText,
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => createMockResponse(data, ok, status, statusText),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// Helper to create mock fetch that returns different responses for different URLs
function mockFetchResponses(responses: Record<string, Response | Error>) {
  return vi.fn((url: string) => {
    const response = responses[url];
    if (response instanceof Error) {
      return Promise.reject(response);
    }
    if (response === undefined) {
      // Return 404 for unregistered URLs (e.g., optional memo.config.json)
      return Promise.resolve(createMockResponse({}, false, 404, 'Not Found'));
    }
    return Promise.resolve(response);
  });
}

describe('RuntimeConfigLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Successful Configuration Loading (Requirement 1.1.1, 1.1.5)', () => {
    it('should fetch both config files on load and render children with configs', async () => {
      // Arrange
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(validSiteConfig),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      const childrenFn = vi.fn((siteConfig: RuntimeSiteConfig, albumConfig: AlbumConfig) => (
        <div data-testid="app-content">
          <span data-testid="site-title">{siteConfig.title}</span>
          <span data-testid="albums-enabled">{albumConfig.enabled.toString()}</span>
        </div>
      ));

      // Act
      render(<RuntimeConfigLoader>{childrenFn}</RuntimeConfigLoader>);

      // Assert - verify both config files are fetched in parallel
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/config.json');
        expect(mockFetch).toHaveBeenCalledWith('/album.config.json');
      });

      // Assert - verify children are rendered with correct configs
      await waitFor(() => {
        expect(screen.getByTestId('app-content')).toBeInTheDocument();
        expect(screen.getByTestId('site-title')).toHaveTextContent('Test Blog');
        expect(screen.getByTestId('albums-enabled')).toHaveTextContent('true');
      });

      // Verify children function was called with correct arguments
      expect(childrenFn).toHaveBeenCalledWith(validSiteConfig, validAlbumConfig, { enabled: false, provider: 'ech0', serverUrl: '' });
    });

    it('should use custom config paths when provided', async () => {
      // Arrange
      const mockFetch = mockFetchResponses({
        '/custom/config.json': createMockResponse(validSiteConfig),
        '/custom/album.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader
          configPath="/custom/config.json"
          albumConfigPath="/custom/album.json"
        >
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/custom/config.json');
        expect(mockFetch).toHaveBeenCalledWith('/custom/album.json');
        expect(screen.getByTestId('loaded')).toBeInTheDocument();
      });
    });

    it('should support basePath configuration for subdirectory deployment', async () => {
      // Arrange
      const configWithBasePath: RuntimeSiteConfig = {
        ...validSiteConfig,
        basePath: '/blog/',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(configWithBasePath),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      const childrenFn = vi.fn((siteConfig: RuntimeSiteConfig) => (
        <div data-testid="base-path">{siteConfig.basePath}</div>
      ));

      // Act
      render(<RuntimeConfigLoader>{childrenFn}</RuntimeConfigLoader>);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('base-path')).toHaveTextContent('/blog/');
      });
    });
  });

  describe('Loading State Display (Requirement 1.1.2)', () => {
    it('should render nothing while fetching configurations (HTML skeleton stays visible)', async () => {
      // Arrange - create a delayed response
      let resolveConfig: (value: Response) => void;
      const configPromise = new Promise<Response>((resolve) => {
        resolveConfig = resolve;
      });

      global.fetch = vi.fn((url: string) => {
        if (url === '/config.json') {
          return configPromise;
        }
        if (url === '/album.config.json') {
          return Promise.resolve(createMockResponse(validAlbumConfig));
        }
        return Promise.resolve(createMockResponse({}, false, 404, 'Not Found'));
      });

      // Act
      const { container } = render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert - nothing is rendered (null), HTML skeleton stays in place
      expect(container.innerHTML).toBe('');
      expect(screen.queryByTestId('loaded')).not.toBeInTheDocument();

      // Resolve the config fetch
      resolveConfig!(createMockResponse(validSiteConfig));

      // Assert - loading should complete
      await waitFor(() => {
        expect(screen.getByTestId('loaded')).toBeInTheDocument();
      });
    });
  });

  describe('HTTP Error Handling (Requirement 1.1.3)', () => {
    it('should display error with HTTP status code when config.json fetch fails with 404', async () => {
      // Arrange
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse({}, false, 404, 'Not Found'),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Configuration Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to load \/config\.json: 404 Not Found/)).toBeInTheDocument();
        expect(screen.getByText('HTTP Status: 404')).toBeInTheDocument();
        expect(screen.queryByTestId('loaded')).not.toBeInTheDocument();
      });
    });

    it('should display error with HTTP status code when config.json fetch fails with 500', async () => {
      // Arrange
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse({}, false, 500, 'Internal Server Error'),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Failed to load \/config\.json: 500 Internal Server Error/)).toBeInTheDocument();
        expect(screen.getByText('HTTP Status: 500')).toBeInTheDocument();
      });
    });

    it('should display error when album.config.json fetch fails', async () => {
      // Arrange
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(validSiteConfig),
        '/album.config.json': createMockResponse({}, false, 403, 'Forbidden'),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Failed to load \/album\.config\.json: 403 Forbidden/)).toBeInTheDocument();
        expect(screen.getByText('HTTP Status: 403')).toBeInTheDocument();
      });
    });

    it('should display error when network request fails', async () => {
      // Arrange
      const mockFetch = mockFetchResponses({
        '/config.json': new Error('Network error'),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Configuration Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to load \/config\.json: Network error/)).toBeInTheDocument();
      });
    });
  });

  describe('JSON Parse Error Handling (Requirement 1.1.4)', () => {
    it('should display parse error when config.json contains invalid JSON', async () => {
      // Arrange
      const invalidJsonResponse: Response = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
        headers: new Headers(),
        redirected: false,
        type: 'basic',
        url: '',
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve('<html>Not JSON</html>'),
        bytes: () => Promise.resolve(new Uint8Array()),
      } as Response;

      global.fetch = vi.fn((url: string) => {
        if (url === '/config.json') {
          return Promise.resolve(invalidJsonResponse);
        }
        if (url === '/album.config.json') {
          return Promise.resolve(createMockResponse(validAlbumConfig));
        }
        return Promise.resolve(createMockResponse({}, false, 404, 'Not Found'));
      });

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Configuration Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to parse \/config\.json/)).toBeInTheDocument();
      });
    });

    it('should display parse error when album.config.json contains invalid JSON', async () => {
      // Arrange
      const invalidJsonResponse: Response = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
        headers: new Headers(),
        redirected: false,
        type: 'basic',
        url: '',
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve('{incomplete'),
        bytes: () => Promise.resolve(new Uint8Array()),
      } as Response;

      global.fetch = vi.fn((url: string) => {
        if (url === '/album.config.json') {
          return Promise.resolve(invalidJsonResponse);
        }
        if (url === '/config.json') {
          return Promise.resolve(createMockResponse(validSiteConfig));
        }
        return Promise.resolve(createMockResponse({}, false, 404, 'Not Found'));
      });

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Configuration Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to parse \/album\.config\.json/)).toBeInTheDocument();
      });
    });
  });

  describe('Required Field Validation (Requirement 1.3.6, 1.3.7)', () => {
    it('should display error when title field is missing', async () => {
      // Arrange
      const configMissingTitle = {
        description: 'A test blog',
        logo: '/logo.png',
        favicon: '/favicon.ico',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(configMissingTitle),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Configuration Error')).toBeInTheDocument();
        expect(screen.getByText('Missing required field: title')).toBeInTheDocument();
        expect(screen.getByText(/Missing field:/)).toBeInTheDocument();
      });
    });

    it('should display error when description field is missing', async () => {
      // Arrange
      const configMissingDescription = {
        title: 'Test Blog',
        logo: '/logo.png',
        favicon: '/favicon.ico',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(configMissingDescription),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: description')).toBeInTheDocument();
      });
    });

    it('should display error when logo field is missing', async () => {
      // Arrange
      const configMissingLogo = {
        title: 'Test Blog',
        description: 'A test blog',
        favicon: '/favicon.ico',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(configMissingLogo),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: logo')).toBeInTheDocument();
      });
    });

    it('should display error when favicon field is missing', async () => {
      // Arrange
      const configMissingFavicon = {
        title: 'Test Blog',
        description: 'A test blog',
        logo: '/logo.png',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(configMissingFavicon),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: favicon')).toBeInTheDocument();
      });
    });

    it('should display error when required field is empty string', async () => {
      // Arrange
      const configWithEmptyTitle = {
        title: '',
        description: 'A test blog',
        logo: '/logo.png',
        favicon: '/favicon.ico',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(configWithEmptyTitle),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: title')).toBeInTheDocument();
      });
    });

    it('should display error when required field is null', async () => {
      // Arrange
      const configWithNullField = {
        title: 'Test Blog',
        description: null,
        logo: '/logo.png',
        favicon: '/favicon.ico',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(configWithNullField),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: description')).toBeInTheDocument();
      });
    });

    it('should display error when config is not an object', async () => {
      // Arrange
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse('not an object'),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: config object')).toBeInTheDocument();
      });
    });

    it('should display error when album config enabled field is missing', async () => {
      // Arrange
      const albumConfigMissingEnabled = {
        albums: [],
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(validSiteConfig),
        '/album.config.json': createMockResponse(albumConfigMissingEnabled),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: enabled')).toBeInTheDocument();
      });
    });

    it('should display error when album config albums field is missing', async () => {
      // Arrange
      const albumConfigMissingAlbums = {
        enabled: true,
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(validSiteConfig),
        '/album.config.json': createMockResponse(albumConfigMissingAlbums),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: albums')).toBeInTheDocument();
      });
    });

    it('should display error when album config albums is not an array', async () => {
      // Arrange
      const albumConfigInvalidAlbums = {
        enabled: true,
        albums: 'not an array',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(validSiteConfig),
        '/album.config.json': createMockResponse(albumConfigInvalidAlbums),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Missing required field: albums')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle config with only required fields', async () => {
      // Arrange
      const minimalConfig = {
        title: 'Minimal Blog',
        description: 'A minimal blog',
        logo: '/logo.png',
        favicon: '/favicon.ico',
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(minimalConfig),
        '/album.config.json': createMockResponse(validAlbumConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {(siteConfig) => <div data-testid="title">{siteConfig.title}</div>}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('title')).toHaveTextContent('Minimal Blog');
      });
    });

    it('should handle empty albums array', async () => {
      // Arrange
      const emptyAlbumsConfig: AlbumConfig = {
        enabled: false,
        albums: [],
      };
      const mockFetch = mockFetchResponses({
        '/config.json': createMockResponse(validSiteConfig),
        '/album.config.json': createMockResponse(emptyAlbumsConfig),
      });
      global.fetch = mockFetch;

      // Act
      render(
        <RuntimeConfigLoader>
          {(_, albumConfig) => (
            <div data-testid="album-count">{albumConfig.albums.length}</div>
          )}
        </RuntimeConfigLoader>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('album-count')).toHaveTextContent('0');
      });
    });

    it('should cancel loading when component unmounts', async () => {
      // Arrange
      let resolveConfig: (value: Response) => void;
      const configPromise = new Promise<Response>((resolve) => {
        resolveConfig = resolve;
      });

      global.fetch = vi.fn((url: string) => {
        if (url === '/config.json') {
          return configPromise;
        }
        if (url === '/album.config.json') {
          return configPromise;
        }
        return Promise.resolve(createMockResponse({}, false, 404, 'Not Found'));
      });

      // Act
      const { unmount } = render(
        <RuntimeConfigLoader>
          {() => <div data-testid="loaded">Loaded</div>}
        </RuntimeConfigLoader>
      );

      // Unmount before fetch completes
      unmount();

      // Resolve the fetch after unmount
      resolveConfig!(createMockResponse(validSiteConfig));

      // Assert - no errors should occur and component should not update
      // This test mainly ensures no "setState on unmounted component" warnings
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });
});
