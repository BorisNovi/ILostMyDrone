import { version } from '../../package.json';

export const environment = {
  version,
  production: true,
  tilesLightUrl: 'https://api.maptiler.com/maps/basic-v2/style.json?key=__MAPTILER_KEY__',
  tilesDarkUrl: 'https://api.maptiler.com/maps/basic-v2-dark/style.json?key=__MAPTILER_KEY__'
};
