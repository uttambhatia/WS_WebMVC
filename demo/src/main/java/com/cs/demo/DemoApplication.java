package com.cs.demo;

import java.io.File;
import java.io.IOException;

import javax.servlet.ServletContext;
import javax.xml.ws.Endpoint;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.ImportResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.oxm.jaxb.Jaxb2Marshaller;
import org.springframework.ws.config.annotation.EnableWs;
import org.springframework.ws.transport.http.MessageDispatcherServlet;
import org.springframework.ws.wsdl.wsdl11.SimpleWsdl11Definition;
import org.springframework.ws.wsdl.wsdl11.Wsdl11Definition;

import com.sun.xml.ws.transport.http.servlet.WSSpringServlet;

@SpringBootApplication
public class DemoApplication {

	public static void main(String[] args) throws IOException {

		// https://www.java2novice.com/spring-boot/load-external-configuration-files/
		String profile = System.getProperty("spring.profiles.active");
		profile = profile!=null ?profile:"local";



		//String logFile = new ClassPathResource(profile+File.separator+"logback.xml").getFile().getAbsolutePath();
		//System.out.println("=============="+logFile);
		ConfigurableApplicationContext applicationContext = new SpringApplicationBuilder(DemoApplication.class)
				.properties("spring.config.name:application", "spring.config.location:classpath:"+profile+File.separator)
				.build().run(args);
		
		//Endpoint.publish("http://localhost:8080/config/services", new HelloWorldWS ()); 

	}


	/*@Bean
	public ServletRegistrationBean messageDispatcherServlet(ApplicationContext applicationContext) {
		MessageDispatcherServlet servlet = new MessageDispatcherServlet();
		servlet.setApplicationContext(applicationContext);
		servlet.setTransformWsdlLocations(true);
		return new ServletRegistrationBean(servlet, "/config/*");
	}*/

	//http://localhost:8080/ws/services.wsdl --bean name is set to 'services'
	/*@Bean(name = "services")
	public Wsdl11Definition defaultWsdl11Definition() {
		SimpleWsdl11Definition wsdl11Definition = new SimpleWsdl11Definition();
		wsdl11Definition.setWsdl(new ClassPathResource("services.wsdl")); //your wsdl location
		return wsdl11Definition;
	}*/


}
