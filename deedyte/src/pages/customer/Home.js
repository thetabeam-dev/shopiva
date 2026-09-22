import { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { getStoredAccessToken } from '../../auth/session';
import {
  selectCategoryOptions,
  selectCategoriesError,
  selectCategoriesLoading,
} from '../../../redux/categoriesSlice';
/** Metro bundles this as a numeric asset id — pass to `source` directly. */
const CUSTOMER_VIDEO = require('../../assets/customer.mp4');

export default function HomeScreen() {
  const [category, setCategory] = useState(null);
  const [categoryGateError, setCategoryGateError] = useState('');

  const navigation = useNavigation();
  const categoryOptions = useSelector(selectCategoryOptions);
  const categoriesLoading = useSelector(selectCategoriesLoading);
  const categoriesError = useSelector(selectCategoriesError);

  function handleExplore() {
    if (!category) {
      setCategoryGateError(
        'Please select a category before exploring vendors.',
      );
      return;
    }
    setCategoryGateError('');
    navigation.navigate('Vendors', { category });
  }

  (async () => {
    const token = await getStoredAccessToken();
    console.log('token: ', token);
  })();
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} collapsable={false}>
        <Video
          source={CUSTOMER_VIDEO}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat
          muted
          paused={false}
          playInBackground={false}
          useTextureView={Platform.OS === 'android'}
          hideShutterView={Platform.OS === 'android'}
          onError={e => console.log('Video error:', e)}
          onLoad={() => console.log('Video loaded')}
        />
      </View>

      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.content}>
        <View>
          <Text style={styles.title}>
            Delivery straight to your doorstep — within minutes.
          </Text>
          <Text style={styles.label}>
            What category of product do you like?
          </Text>
        </View>

        <View style={styles.dropdownBlock}>
          <Dropdown
            style={styles.dropdown}
            containerStyle={styles.dropdownContainer}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            itemTextStyle={styles.itemTextStyle}
            inputSearchStyle={styles.inputSearchStyle}
            iconStyle={styles.iconStyle}
            data={categoryOptions}
            disable={categoriesLoading || categoryOptions.length === 0}
            search
            maxHeight={280}
            labelField="label"
            valueField="value"
            placeholder={categoriesLoading ? 'Loading categories...' : 'Select category'}
            searchPlaceholder="Search categories..."
            value={category}
            onChange={item => {
              setCategory(item.value);
              setCategoryGateError('');
            }}
          />
          {categoriesError ? <Text style={styles.errorText}>{categoriesError}</Text> : null}
          {categoryGateError ? (
            <Text style={styles.errorText}>{categoryGateError}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.btn, (categoriesLoading || categoryOptions.length === 0) && styles.btnDisabled]}
          onPress={handleExplore}
          activeOpacity={0.85}
          disabled={categoriesLoading || categoryOptions.length === 0}
        >
          <Text style={styles.btnText}>Explore Vendors</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  dropdownBlock: {
    width: '95%',
    alignSelf: 'center',
  },
  dropdown: {
    minHeight: 52,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },
  dropdownContainer: {
    borderRadius: 10,
  },
  placeholderStyle: {
    fontSize: 16,
    color: '#888',
  },
  selectedTextStyle: {
    fontSize: 16,
    color: '#111',
  },
  itemTextStyle: {
    fontSize: 16,
    color: '#111',
  },
  inputSearchStyle: {
    height: 44,
    fontSize: 16,
    borderRadius: 10,
    // borderColor: '#e0e0e0',
    // borderWidth: 1,
    paddingHorizontal: 10,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#ffcdd2',
  },
  btn: {
    height: 60,
    width: '95%',
    backgroundColor: '#00926e',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 25,
    textAlign: 'center',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  label: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 10,
    color: '#f5f5f5',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
