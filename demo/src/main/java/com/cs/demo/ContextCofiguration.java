package com.cs.demo;

import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportResource;
import org.springframework.web.servlet.DispatcherServlet;

import com.sun.xml.ws.transport.http.servlet.WSSpringServlet;

@ServletComponentScan
@EnableAutoConfiguration
@ImportResource("classpath:ws-binding.xml")
@ComponentScan(basePackages = {"com.cs.demo"})
@Configuration
public class ContextCofiguration {

	
	@Bean
	public ServletRegistrationBean dispatcherServlet() {
		WSSpringServlet wsSpringServlet = new WSSpringServlet();
		//MessageDispatcherServlet wsSpringServlet = new MessageDispatcherServlet();
		return new ServletRegistrationBean(wsSpringServlet, "/config/*");
	} 
	@Bean
	public ServletRegistrationBean dispatcherServlet1() {
		//WSSpringServlet wsSpringServlet = new WSSpringServlet();
		DispatcherServlet wsSpringServlet = new DispatcherServlet();
		return new ServletRegistrationBean(wsSpringServlet, "/ui/*");
	}
	/*
	@Bean
	public Jaxb2Marshaller marshaller() {
		Jaxb2Marshaller marshaller = new Jaxb2Marshaller();
		marshaller.setPackagesToScan("com.cs.demo.pojo");
		return marshaller;
	}*/
	
}
