import { Image, Platform, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';

const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)(\?|#|$)/i;

export function isVideoUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  if (VIDEO_FILE.test(value)) return true;
  return /\/video\/upload\//i.test(value);
}

export function ProductCardMedia({ uri, style }) {
  if (!uri) {
    return (
      <View style={[style, styles.empty]}>
        <Icon name="image-outline" size={28} color="#9A9A9A" />
      </View>
    );
  }

  if (isVideoUrl(uri)) {
    return (
      <View style={[style, styles.clip]}>
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          muted
          repeat
          paused={false}
          playInBackground={false}
          ignoreSilentSwitch="obey"
          useTextureView={Platform.OS === 'android'}
        />
      </View>
    );
  }

  return <Image source={{ uri }} style={style} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F3F3',
  },
});
