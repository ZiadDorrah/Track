import React, { createContext, useContext, useState, useEffect } from 'react';

const CurrentUserContext = createContext({
  user: null,
  setUser: () => {},
  isManager: false,
  isAdmin: false,
  team: [],
  managers: [],
  refreshUser: async () => {},
  authLoading: true,
});

export function CurrentUserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState([]);
  const [managers, setManagers] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  const fetchUserData = async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setUser(meData.user);

          // Fetch direct reports and managers in parallel
          const [teamRes, mgrRes] = await Promise.all([
            fetch('/api/users/me/team'),
            fetch('/api/users/me/managers')
          ]);

          if (teamRes.ok) {
            const teamData = await teamRes.json();
            setTeam(teamData);
          }
          if (mgrRes.ok) {
            const mgrData = await mgrRes.json();
            setManagers(mgrData);
          }
        } else {
          setUser(null);
          setTeam([]);
          setManagers([]);
        }
      } else {
        setUser(null);
        setTeam([]);
        setManagers([]);
      }
    } catch (err) {
      console.error('Failed to load current user context:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const isManager = team.length > 0;
  const isAdmin = Boolean(user && user.isAdmin);

  return (
    <CurrentUserContext.Provider
      value={{
        user,
        setUser,
        isManager,
        isAdmin,
        team,
        managers,
        refreshUser: fetchUserData,
        authLoading,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
