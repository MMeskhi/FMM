import { useEffect, useState } from 'react';
import './TitleBar.css';

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.windowControls.isMaximized().then(setIsMaximized);
    return window.windowControls.onMaximizedChange(setIsMaximized);
  }, []);

  return (
    <div className="title-bar">
      <span className="title-bar-label">FMM</span>
      <div className="title-bar-controls">
        <button onClick={() => window.windowControls.minimize()} aria-label="Minimize">
          &#x2013;
        </button>
        <button
          onClick={() => window.windowControls.maximizeToggle()}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? '❐' : '☐'}
        </button>
        <button
          onClick={() => window.windowControls.close()}
          className="title-bar-close"
          aria-label="Close"
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
