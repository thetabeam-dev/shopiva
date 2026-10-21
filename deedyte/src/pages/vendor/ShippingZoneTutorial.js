import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Video from 'react-native-video';
import { getShippingTutorialVideoUrl } from '../../api/user';
import { BRAND } from './shippingShared';

export default function ShippingZoneTutorial({ visible, onClose }) {
  const { height: windowHeight } = useWindowDimensions();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    getShippingTutorialVideoUrl()
      .then((url) => {
        if (active) setVideoUrl(url);
      })
      .catch(() => {
        if (active) setVideoUrl('');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 7, paddingHorizontal: 16, paddingVertical: 18, height: windowHeight * 0.85 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111111', textAlign: 'center' }}>
            How to set up a shipping zone
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: '#6B7280', textAlign: 'center' }}>
            Add a zone, choose the states it covers, then set the fee for the first item and the discount for extra items.
          </Text>
          <View style={{ flex: 1, borderRadius: 7, overflow: 'hidden', marginTop: 14, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
            {!loading && videoUrl ? (
              <Video
                source={{ uri: videoUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
                controls
                paused={!visible}
                playInBackground={false}
                ignoreSilentSwitch="ignore"
                useTextureView={Platform.OS === 'android'}
              />
            ) : null}
            {!loading && !videoUrl ? (
              <Text style={{ color: '#FFFFFF', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 }}>
                Tutorial video is not available yet.
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.88}
            style={{
              marginTop: 16,
              borderRadius: 7,
              borderWidth: 1,
              borderColor: BRAND,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: BRAND, fontSize: 15, fontWeight: '700' }}>Skip tutorial</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
