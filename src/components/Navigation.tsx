import React from 'react';
import { NavLink } from 'react-router-dom';

<div className="pt-2 pb-3 space-y-1">
  <NavLink
    to="/trips"
    className={({ isActive }: { isActive: boolean }) =>
      `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
        isActive
          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
          : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
      }`
    }
  >
    My Trips
  </NavLink>
  <NavLink
    to="/calendar"
    className={({ isActive }: { isActive: boolean }) =>
      `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
        isActive
          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
          : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
      }`
    }
  >
    Calendar
  </NavLink>
</div> 