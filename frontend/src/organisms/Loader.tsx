import { Center, Text, Box } from '@chakra-ui/react';
import React from 'react';
import { LogoIcon } from '../atoms/LogoIcon';

interface LoaderProps {
  children: React.ReactNode;
}

export function Loader(props: LoaderProps) {
  return (
    <Center h="100vh">
      <Box display="flex" flexDirection="column" alignItems="center">
        <LogoIcon fontSize="150px" animate={true} />
        <Text mt="40px">{props.children}</Text>
      </Box>
    </Center>
  );
}
