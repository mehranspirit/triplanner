import * as React from 'react';
import { networkAwareApi } from '../services/networkAwareApi';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = React.useState(networkAwareApi.getIsOnline());

  React.useEffect(() => {
    setIsOnline(networkAwareApi.getIsOnline());
    return networkAwareApi.subscribeOnlineStatus(setIsOnline);
  }, []);

  return isOnline;
};
