import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories, selectCategoriesState } from '../../redux/categoriesSlice';

/**
 * Loads categories once on app startup and keeps them in Redux.
 */
export default function CategoryBootstrap() {
  const dispatch = useDispatch();
  const { lastFetchedAt, isLoading } = useSelector(selectCategoriesState);

  useEffect(() => {
    if (!lastFetchedAt && !isLoading) {
      void dispatch(fetchCategories());
    }
  }, [dispatch, isLoading, lastFetchedAt]);

  return null;
}
