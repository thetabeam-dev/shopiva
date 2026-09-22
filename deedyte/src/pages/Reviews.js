import React, {useState} from 'react'
import { Dimensions, Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import { ScrollView, Text } from 'react-native'
import ReviewSvg from '../assets/review-svgrepo-com.svg'
import StarRating from 'react-native-star-rating-widget';
import { useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export function Reviews() {
    const { data } = useRoute()?.params;
    const screenHeight = Dimensions.get('window').height;
    const screenWidth = Dimensions.get('window').width;
    const [expandedReview, setExpandedReview] = useState(null);

    const toggleExpand = (index) => {
        if (expandedReview === index) {
            setExpandedReview(null);
        } else {
            setExpandedReview(index);
        }
    };

    // Calculate average rating
    const averageRating = data.length > 0 
        ? (data.reduce((sum, item) => sum + parseInt(item.rating), 0) / data.length).toFixed(1)
        : 0;

    // Group reviews by rating
    const ratingDistribution = {
        5: data.filter(item => parseInt(item.rating) === 5).length,
        4: data.filter(item => parseInt(item.rating) === 4).length,
        3: data.filter(item => parseInt(item.rating) === 3).length,
        2: data.filter(item => parseInt(item.rating) === 2).length,
        1: data.filter(item => parseInt(item.rating) === 1).length
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <View style={styles.container}>
            {data.length === 0 ? (
                <View style={styles.emptyState}>
                    <ReviewSvg width={120} height={120} />
                    <Text style={styles.emptyStateTitle}>No Reviews Yet</Text>
                    <Text style={styles.emptyStateText}>
                        Customer reviews will appear here once you start receiving feedback on your products.
                    </Text>
                </View>
            ) : (
                <ScrollView 
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Reviews Header with Stats */}
                    <View style={styles.header}>
                        <View style={styles.ratingOverview}>
                            <Text style={styles.averageRating}>{averageRating}</Text>
                            <StarRating
                                rating={parseFloat(averageRating)}
                                starSize={24}
                                color="#FF4500"
                                starStyle={{marginRight: 2}}
                                onChange={() => {}}
                            />
                            <Text style={styles.totalReviews}>{data.length} reviews</Text>
                        </View>
                        
                        {/* Rating Distribution */}
                        <View style={styles.ratingDistribution}>
                            {[5, 4, 3, 2, 1].map((rating) => (
                                <View key={rating} style={styles.ratingBarContainer}>
                                    <Text style={styles.ratingNumber}>{rating}</Text>
                                    <Ionicons name="star" size={16} color="#FF4500" />
                                    <View style={styles.ratingBarBackground}>
                                        <View 
                                            style={[
                                                styles.ratingBarFill,
                                                { 
                                                    width: `${(ratingDistribution[rating] / data.length) * 100}%`,
                                                    backgroundColor: rating >= 4 ? '#22C55E' : rating >= 3 ? '#F59E0B' : '#EF4444'
                                                }
                                            ]} 
                                        />
                                    </View>
                                    <Text style={styles.ratingCount}>{ratingDistribution[rating]}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Reviews List */}
                    <View style={styles.reviewsList}>
                        {data.map((item, index) => (
                            <View key={index} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.ratingContainer}>
                                        <StarRating
                                            rating={parseInt(item.rating)}
                                            starSize={20}
                                            color="#FF4500"
                                            starStyle={{marginRight: 1}}
                                            onChange={() => {}}
                                        />
                                        <Text style={styles.reviewDate}>{formatDate(item.date)}</Text>
                                    </View>
                                </View>
                                
                                <Text style={styles.reviewTitle} numberOfLines={2}>
                                    {item.review}
                                </Text>
                                
                                {item.comment && (
                                    <>
                                        <Text 
                                            style={[
                                                styles.reviewComment,
                                                expandedReview === index && styles.expandedComment
                                            ]}
                                            numberOfLines={expandedReview === index ? undefined : 3}
                                        >
                                            {item.comment}
                                        </Text>
                                        {item.comment.length > 150 && (
                                            <TouchableOpacity 
                                                onPress={() => toggleExpand(index)}
                                                style={styles.readMoreButton}
                                            >
                                                <Text style={styles.readMoreText}>
                                                    {expandedReview === index ? 'Read less' : 'Read more'}
                                                </Text>
                                                <Ionicons 
                                                    name={expandedReview === index ? "chevron-up" : "chevron-down"} 
                                                    size={16} 
                                                    color="#FF4500" 
                                                />
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                                
                                <View style={styles.reviewFooter}>
                                    <View style={styles.reviewerInfo}>
                                        <Ionicons name="person-circle-outline" size={20} color="#64748B" />
                                        <Text style={styles.reviewerText}>Customer Review</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollView: {
        flex: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#FFF',
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#374151',
        marginTop: 24,
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
    },
    header: {
        backgroundColor: '#FFF',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    ratingOverview: {
        alignItems: 'center',
        marginBottom: 24,
    },
    averageRating: {
        fontSize: 48,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 8,
    },
    totalReviews: {
        fontSize: 16,
        color: '#64748B',
        marginTop: 8,
    },
    ratingDistribution: {
        gap: 12,
    },
    ratingBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    ratingNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        width: 16,
    },
    ratingBarBackground: {
        flex: 1,
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
    },
    ratingBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    ratingCount: {
        fontSize: 14,
        color: '#64748B',
        minWidth: 24,
        textAlign: 'right',
    },
    reviewsList: {
        padding: 8,
        gap: 16,
    },
    reviewCard: {
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    reviewHeader: {
        marginBottom: 16,
    },
    ratingContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reviewDate: {
        fontSize: 14,
        color: '#6B7280',
    },
    reviewTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 12,
        lineHeight: 24,
    },
    reviewComment: {
        fontSize: 16,
        color: '#4B5563',
        lineHeight: 24,
        marginBottom: 8,
    },
    expandedComment: {
        lineHeight: 24,
    },
    readMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    readMoreText: {
        fontSize: 14,
        color: '#FF4500',
        fontWeight: '500',
        marginRight: 4,
    },
    reviewFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 16,
    },
    reviewerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reviewerText: {
        fontSize: 14,
        color: '#64748B',
    },
});
