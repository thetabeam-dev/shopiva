import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
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
 * Android Explore Map — TomTom Leaflet inside WebView.
 * Gesture-handler FlatList keeps the shop sheet scrolling instead of the map.
 */
export default function ExploreMap({ navigation, route }) {
  const webRef = useRef(null);
  const mapApiRef = useRef({});
  const ctrl = useExploreMapController(navigation, route, mapApiRef);
  const { setMapRegion, visibleShops, notifyMapReady, openShop } = ctrl;

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

  return (
    <ExploreMapShell
      ctrl={ctrl}
      navigation={navigation}
      FlatListComponent={FlatList}
      cardDelayPressIn={120}
      mapSurface={(
        <WebView
          ref={webRef}
          style={StyleSheet.absoluteFillObject}
          originWhitelist={['*']}
          source={{ html: tomtomLeafletHtml(tomtomTileUrl()) }}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onLoadEnd={() => {
            notifyMapReady();
            mapApiRef.current.renderPins?.(visibleShops, ctrl.showMe ? ctrl.savedCoord : null);
            mapApiRef.current.setInteractive?.(!ctrl.sheetExpanded);
          }}
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
      )}
    />
  );
}
