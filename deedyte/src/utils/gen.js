import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../api';
// import Memory from './memoryHandler';
import {
  Alert,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
// import Geolocation from '@react-native-community/geolocation';
import Sound from 'react-native-sound';

class Tools {
  static playSound = async () => {
    Sound.setCategory('Playback');
    const ding = new Sound('activity.mp3', Sound.MAIN_BUNDLE, error => {
      if (error) {
        console.log('Failed to load the sound', error);
        return;
      }
      ding.play(success => {
        if (!success) {
          console.log('Playback failed due to audio decoding errors');
        }
        ding.release(); // free memory after playback
      });
    });
  };
  static async getDeviceId() {
    // Do not import react-native-device-info at module load: it throws if
    // NativeModules.RNDeviceInfo is null (stale iOS build, pods not applied).
    if (!NativeModules.RNDeviceInfo) {
      const fallback = Tools.generateId(24);
      console.warn(
        'RNDeviceInfo native module missing; using generated id. Rebuild the app after pod install.',
        fallback,
      );
      return fallback;
    }
    const { getUniqueId } = require('react-native-device-info');
    const uniqueId = await getUniqueId();
    console.log('Device Unique ID:', uniqueId);
    return uniqueId;
  }

  static generateId(length) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';

    for (let i = 0; i < length; i++) {
      const randIndex = Math.floor(Math.random() * chars.length);
      id += chars[randIndex];
    }

    return id;
  }

  // static async createView({data, user_id}){

  //     const response = await Product.createView({
  //         product_id: data?.product_id,
  //         user_id
  //     })
  //     if (response?.success) {
  //         const newHistory = { date: new Date(), data: data };
  //         const prevHistory = await Memory.get('history');
  //         console.log(prevHistory)
  //         if(prevHistory){
  //             const arr = (prevHistory);
  //             let duplicate = arr.filter(item => item.data.product_id === data?.product_id).length>0;
  //             if(!duplicate){
  //                 Memory.store('history', ([...arr, newHistory]));
  //             }
  //         }else{
  //             Memory.store('history', ([newHistory]));
  //         }

  //     }
  // }

  static capitalize(str) {
    return str && str.charAt(0).toUpperCase() + str.slice(1);
  }

  static formatNumber(num) {
    if (num < 1000) {
      return num.toString(); // leave small numbers as-is
    } else if (num < 1_000_000) {
      return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'k';
    } else if (num < 1_000_000_000) {
      return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + 'm';
    } else {
      return (
        (num / 1_000_000_000).toFixed(num % 1_000_000_000 === 0 ? 0 : 1) + 'b'
      );
    }
  }

  static generateConversationId(userA, userB) {
    // console.log(userA, userB)
    if (userA === userB) {
      throw new Error('Conversation requires two different users');
    }
    // Sort the two IDs lexicographically (alphabet + number ordering)
    return [userA, userB]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .join('_');
  }

  static generateDealStatusAfterPurchase() {
    return {
      refunded: {
        outcome: null,
        completed: false,
        completedAt: null,
      },
      shipping: {
        outcome: null,
        completed: false,
        completedAt: null,
      },
      cancelled: {
        outcome: null,
        completed: false,
        completedAt: null,
      },
      completed: {
        outcome: null,
        completed: false,
        completedAt: null,
        buyer: false,
        vendor: false,
      },
      confirmed: {
        outcome: null,
        completed: false,
        completedAt: null,
      },
      delivered: {
        outcome: null,
        completed: false,
        completedAt: null,
      },
      purchased: {
        outcome: 'success',
        completed: true,
        completedAt: new Date(),
      },
    };
  }

  static capitalize = str =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  static lower_case = str =>
    str ? str.charAt(0).toLowerCase() + str.slice(1) : '';

  static requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs camera access to take photos.',
          buttonPositive: 'OK',
        },
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // iOS handles via Info.plist
  };

  static getTimeAgo = pastDate => {
    if (!pastDate) return '';

    const now = new Date();
    const past = new Date(pastDate);
    const diffMs = now - past; // difference in milliseconds

    // Convert to seconds, minutes, hours, days
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 1) {
      return `${days} day${days > 1 ? 's' : ''} & Counting`;
    } else if (hours >= 1) {
      return `${hours} hour${hours > 1 ? 's' : ''} & Counting`;
    } else if (minutes >= 1) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} & Counting`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''} & Counting`;
    }
  };

  static formatDealDate = dateString => {
    if (!dateString) return '';

    const date = new Date(dateString);

    // Get date parts
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();

    // Add ordinal suffix (st, nd, rd, th)
    const getOrdinal = n => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return s[(v - 20) % 10] || s[v] || s[0];
    };

    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;

    return `${day}${getOrdinal(
      day,
    )} ${month} ${year} by ${hour12}:${minutes}${ampm}`;
  };

  static async requestLocationPermission() {
    if (Platform.OS === 'ios') {
      return true;
    }
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  static async getUserLocation() {
    try {
      const position = await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          pos => resolve(pos),
          error => reject(error),
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          },
        );
      });

      const { latitude, longitude } = position.coords;
      console.log('coords:', latitude, longitude);

      return { latitude, longitude };
    } catch (error) {
      console.log('Error getting location:', error.message);
      return null;
    }
  }

  static async getAddressFromCoordinates(latitude, longitude) {
    console.log(latitude, longitude);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        {
          headers: {
            'User-Agent': 'deedyte/1.0 (admin@thetabeam.com)', // <-- Important
          },
        },
      );

      const data = await response.json();
      console.log('Nominatim Response:', data); // <-- Add this to inspect

      if (data && data.display_name) {
        return data;
      } else {
        console.log('No address found in response');
        return null;
      }
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
      return null;
    }
  }

  static cyclicTimeWatch(pastDate, durationHours = 6) {
    const start = new Date(pastDate);
    const now = new Date();

    // Milliseconds between now and the past date
    const elapsedMs = now - start;

    // Milliseconds for the full duration (e.g., 6 hours)
    const durationMs = durationHours * 60 * 60 * 1000;

    // Remaining time until duration expires
    const remainingMs = Math.max(durationMs - elapsedMs, 0);

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    return {
      elapsedHours: Math.floor(elapsedMs / (1000 * 60 * 60)),
      elapsedMinutes: Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60)),
      remaining: `${hours}h ${minutes}m ${seconds}s`,
      expired: remainingMs <= 0,
    };
  }

  static async Memory() {
    return {
      async store(key, value) {
        try {
          await AsyncStorage.setItem(key, JSON.stringify(value));
          console.log('Data saved successfully!');
        } catch (error) {
          console.error('Error saving data:', error);
        }
      },

      async get(key) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (!value) return false;
          if (value !== null) {
            return JSON.parse(value); // return stored value
          } else {
            return false; // return false if null
          }
        } catch (e) {
          console.error('Failed to fetch data', e);
          return false;
        }
      },

      async clear() {
        try {
          await AsyncStorage.clear();
          console.log('All data cleared!');
          return true;
        } catch (e) {
          console.error('Failed to clear data', e);
          return false;
        }
      },
    };
  }
}

export default Tools;
