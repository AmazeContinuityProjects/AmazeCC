"use client";

import { LoginForm as AmazeUILoginForm } from "@amazecontinuityprojects/amazeui";
import { getActiveApiUrl, setActiveApiUrl, PRIMARY_API_URL, BACKUP_API_URL } from "@/lib/fetch-utils";
import { useEffect, useState } from "react";

interface LoginFormProps {
  username: any;
  setUsername: any;
  password: any;
  setPassword: any;
  message: any;
  handleFormSubmit: any;
  handleDemoClick: any;
  residentialStatus: any;
  setResidentialStatus: any;
  isDayscholarWithBus: any;
  setIsDayscholarWithBus: any;
}

export default function LoginForm(props: LoginFormProps) {
  const [activeApi, setActiveApi] = useState("");

  useEffect(() => {
    setActiveApi(getActiveApiUrl());
  }, []);

  const handleApiChange = (newUrl: string) => {
    setActiveApiUrl(newUrl);
    setActiveApi(newUrl);
  };

  // We only mount the wrapped form after we have initialized the activeApi, 
  // but it's safe to pass empty string initially.
  
  return (
    <AmazeUILoginForm 
      {...props}
      activeApi={activeApi || PRIMARY_API_URL}
      onApiChange={handleApiChange}
      primaryApiUrl={PRIMARY_API_URL}
      backupApiUrl={BACKUP_API_URL}
    />
  );
}
