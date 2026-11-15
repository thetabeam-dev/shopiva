import { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { tomtomTileUrl } from '../../utils/tomtom';
import ExploreMapShell from './ExploreMapShell';
import {
  mapPinFromShop,
  tomtomLeafletHtml,
  useExploreMapController,
  zoomForDelta,
} from './exploreMapCommon';

/**
 * iOS Explore Map — TomTom Leaflet in WKWebView.
 * Native Google/Apple MapView was blanking the screen and covering zoom/locate.
 */
export default function ExploreMap({ navigation, route }) {
  const webRef = useRef(null);
  const mapApiRef = useRef({});
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const ctrl = useExploreMapController(navigation, route, mapApiRef);
  const { setMapRegion, visibleShops, notifyMapReady, openShop, showMe, savedCoord, sheetExpanded } = ctrl;

  mapApiRef.current = {
    moveToRegion: (region) => {
      webRef.current?.injectJavaScript(
        `window.moveTo && window.moveTo(${region.latitude}, ${region.longitude}, ${zoomForDelta(region.latitudeDelta)}); true;`,
      );
    },
    zoomByFactor: (factor) => {
      const step = factor < 1 ? 1 : -1;
      webRef.current?.injectJavaScript(`window.zoomBy && window.zoomBy(${step}); true;`);
    },
    setInteractive: (on) => {
      webRef.current?.injectJavaScript(
        `window.setMapInteractive && window.setMapInteractive(${on ? 'true' : 'false'}); true;`,
      );
    },
    renderPins: (shops, me) => {
      const pins = (shops || []).map(({ shop, coordinate }) => mapPinFromShop(shop, coordinate));
      webRef.current?.injectJavaScript(
        `window.renderPins && window.renderPins(${JSON.stringify(pins)}, ${JSON.stringify(me)}); true;`,
      );
    },
  };

  const syncWebMap = () => {
    notifyMapReady();
    mapApiRef.current.renderPins?.(visibleShops, showMe ? savedCoord : null);
    mapApiRef.current.setInteractive?.(!sheetExpanded);
  };

  return (
    <ExploreMapShell
      ctrl={ctrl}
      navigation={navigation}
      FlatListComponent={FlatList}
      cardDelayPressIn={0}
      mapSurface={(
        <View
          style={{ flex: 1 }}
          collapsable={false}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            if (width > 0 && height > 0) setMapSize({ width, height });
          }}
        >
          {mapSize.width > 0 && mapSize.height > 0 ? (
            <WebView
              ref={webRef}
              style={{ width: mapSize.width, height: mapSize.height, backgroundColor: '#E7EEF2' }}
              originWhitelist={['*']}
              source={{ html: tomtomLeafletHtml(tomtomTileUrl()), baseUrl: 'https://api.tomtom.com' }}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              scrollEnabled={false}
              bounces={false}
              onLoadEnd={syncWebMap}
              onMessage={(event) => {
                let message = null;
                try {
                  message = JSON.parse(event.nativeEvent.data);
                } catch {
                  message = null;
                }
                if (!message) return;
                if (message.type === 'region') {
                  setMapRegion({
                    latitude: Number(message.latitude),
                    longitude: Number(message.longitude),
                    latitudeDelta: Number(message.latitudeDelta),
                    longitudeDelta: Number(message.longitudeDelta),
                  });
                  return;
                }
                if (message.type === 'shop') {
                  const match = visibleShops.find((item) => String(item.shop.id) === String(message.id));
                  if (match) openShop(match.shop);
                }
              }}
            />
          ) : null}
        </View>
      )}
    />
  );
}
